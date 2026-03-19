#define XXH_INLINE_ALL

#include <emscripten.h>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <algorithm>

#include "Luau/Compiler.h"
#include "Luau/BytecodeBuilder.h"
#include "Luau/BytecodeUtils.h"

#include "zstd.h"
#include "xxhash.h"
#include "blake3.h"

// ── Opcode encoder (same as compile_bytecode.exe) ──

class BytecodeEncoder227 : public Luau::BytecodeEncoder {
    void encode(uint32_t* data, size_t count) override {
        for (size_t i = 0; i < count;) {
            auto& opcode = *reinterpret_cast<uint8_t*>(data + i);
            i += Luau::getOpLength(LuauOpcode(opcode));
            opcode *= 227;
        }
    }
};

// ── Bytecode signing + compression (exact copy from bytecode.h) ──

static constexpr uint8_t BYTECODE_SIGNATURE[4] = { 'R', 'S', 'B', '1' };
static constexpr uint8_t BYTECODE_HASH_MULTIPLIER = 41;
static constexpr uint32_t BYTECODE_HASH_SEED = 42u;

static constexpr uint32_t MAGIC_A = 0x4C464F52;
static constexpr uint32_t MAGIC_B = 0x946AC432;
static constexpr uint8_t KEY_BYTES[4] = { 0x52, 0x4F, 0x46, 0x4C };

static inline uint8_t rotl8(uint8_t value, int shift) {
    shift &= 7;
    return (value << shift) | (value >> (8 - shift));
}

static std::string SignBytecode(const std::string& bytecode) {
    if (bytecode.empty())
        return "";

    constexpr uint32_t FOOTER_SIZE = 40u;

    std::vector<uint8_t> blake3_hash(32);
    {
        blake3_hasher hasher;
        blake3_hasher_init(&hasher);
        blake3_hasher_update(&hasher, bytecode.data(), bytecode.size());
        blake3_hasher_finalize(&hasher, blake3_hash.data(), blake3_hash.size());
    }

    std::vector<uint8_t> transformed_hash(32);
    for (int i = 0; i < 32; ++i) {
        uint8_t byte = KEY_BYTES[i & 3];
        uint8_t hash_byte = blake3_hash[i];
        uint8_t combined = byte + i;
        uint8_t result;
        switch (i & 3) {
        case 0: result = rotl8(hash_byte ^ ~byte, ((combined & 3) + 1)); break;
        case 1: result = rotl8(byte ^ ~hash_byte, ((combined & 3) + 2)); break;
        case 2: result = rotl8(hash_byte ^ ~byte, ((combined & 3) + 3)); break;
        case 3: result = rotl8(byte ^ ~hash_byte, ((combined & 3) + 4)); break;
        }
        transformed_hash[i] = result;
    }

    std::vector<uint8_t> footer(FOOTER_SIZE, 0);
    uint32_t first_hash_dword = *reinterpret_cast<uint32_t*>(transformed_hash.data());
    uint32_t footer_prefix = first_hash_dword ^ MAGIC_B;
    memcpy(&footer[0], &footer_prefix, 4);
    uint32_t xor_ed = first_hash_dword ^ MAGIC_A;
    memcpy(&footer[4], &xor_ed, 4);
    memcpy(&footer[8], transformed_hash.data(), 32);

    std::string signed_bytecode = bytecode;
    signed_bytecode.append(reinterpret_cast<const char*>(footer.data()), footer.size());
    return signed_bytecode;
}

static std::string Compress(const std::string& bytecode) {
    const auto MaxSize = ZSTD_compressBound(bytecode.size());
    auto Buffer = std::vector<char>(MaxSize + 8);

    memcpy(&Buffer[0], BYTECODE_SIGNATURE, 4);
    const auto Size = static_cast<uint32_t>(bytecode.size());
    memcpy(&Buffer[4], &Size, sizeof(Size));

    const auto compressed_size = ZSTD_compress(&Buffer[8], MaxSize, bytecode.data(), bytecode.size(), ZSTD_maxCLevel());
    if (ZSTD_isError(compressed_size))
        return "";

    const auto FinalSize = compressed_size + 8;
    Buffer.resize(FinalSize);

    const auto HashKey = XXH32(Buffer.data(), FinalSize, BYTECODE_HASH_SEED);
    const auto Bytes = reinterpret_cast<const uint8_t*>(&HashKey);

    for (auto i = 0u; i < FinalSize; ++i)
        Buffer[i] ^= (Bytes[i % 4] + i * BYTECODE_HASH_MULTIPLIER) & 0xFF;

    return std::string(Buffer.data(), FinalSize);
}

// ── Exported API ──

static char* g_result = nullptr;
static size_t g_result_size = 0;

static void setResult(const std::string& data) {
    if (g_result) { free(g_result); g_result = nullptr; g_result_size = 0; }
    if (data.empty()) return;
    g_result_size = data.size();
    g_result = (char*)malloc(g_result_size);
    memcpy(g_result, data.data(), g_result_size);
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
int compileFull(const char* source, int sourceLen, int wrapTask) {
    setResult("");

    std::string src(source, sourceLen);
    if (wrapTask) {
        src = "task.spawn(function()\n" + src + "\nend)\nwhile true do task.wait(9e9) end";
    }

    BytecodeEncoder227 encoder;
    std::string bytecode = Luau::compile(src, {}, {}, &encoder);

    if (bytecode.empty() || bytecode[0] == '\0') {
        return 0;
    }

    std::string signed_bc = SignBytecode(bytecode);
    if (signed_bc.empty()) return 0;

    std::string rsb1 = Compress(signed_bc);
    if (rsb1.empty()) return 0;

    setResult(rsb1);
    return (int)g_result_size;
}

EMSCRIPTEN_KEEPALIVE
const char* getResult() { return g_result; }

EMSCRIPTEN_KEEPALIVE
int getResultSize() { return (int)g_result_size; }

EMSCRIPTEN_KEEPALIVE
const char* getError(const char* source, int sourceLen, int wrapTask) {
    std::string src(source, sourceLen);
    if (wrapTask) {
        src = "task.spawn(function()\n" + src + "\nend)\nwhile true do task.wait(9e9) end";
    }

    BytecodeEncoder227 encoder;
    std::string bytecode = Luau::compile(src, {}, {}, &encoder);

    if (!bytecode.empty() && bytecode[0] == '\0') {
        static std::string err;
        err = bytecode.substr(1);
        err.erase(std::remove(err.begin(), err.end(), '\0'), err.end());
        return err.c_str();
    }
    return nullptr;
}

EMSCRIPTEN_KEEPALIVE
void freeResult() {
    if (g_result) { free(g_result); g_result = nullptr; g_result_size = 0; }
}

}
