#include <emscripten.h>
#include <cstdlib>
#include <cstring>
#include "Luau/Compiler.h"
#include "Luau/BytecodeBuilder.h"
#include "Luau/BytecodeUtils.h"
#include "zstd.h"

class BytecodeEncoder227 : public Luau::BytecodeEncoder {
    void encode(uint32_t* data, size_t count) override {
        for (size_t i = 0; i < count;) {
            auto& opcode = *reinterpret_cast<uint8_t*>(data + i);
            i += Luau::getOpLength(LuauOpcode(opcode));
            opcode *= 227;
        }
    }
};

static char* g_result = nullptr;
static size_t g_result_size = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int compile(const char* source, int sourceLen) {
    if (g_result) { free(g_result); g_result = nullptr; g_result_size = 0; }

    std::string src(source, sourceLen);
    BytecodeEncoder227 encoder;
    std::string bytecode = Luau::compile(src, {}, {}, &encoder);

    if (bytecode.empty()) return 0;
    if (bytecode[0] == '\0') return 0;

    g_result_size = bytecode.size();
    g_result = (char*)malloc(g_result_size);
    memcpy(g_result, bytecode.data(), g_result_size);
    return (int)g_result_size;
}

EMSCRIPTEN_KEEPALIVE
const char* getResult() { return g_result; }

EMSCRIPTEN_KEEPALIVE
int getResultSize() { return (int)g_result_size; }

EMSCRIPTEN_KEEPALIVE
const char* getError(const char* source, int sourceLen) {
    std::string src(source, sourceLen);
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

EMSCRIPTEN_KEEPALIVE
int zstdCompress(const char* src, int srcLen, char* dst, int dstCap, int level) {
    size_t ret = ZSTD_compress(dst, dstCap, src, srcLen, level);
    if (ZSTD_isError(ret)) return -1;
    return (int)ret;
}

EMSCRIPTEN_KEEPALIVE
int zstdBound(int srcLen) {
    return (int)ZSTD_compressBound(srcLen);
}

}
