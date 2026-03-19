#!/bin/bash
set -e

EMSDK="$HOME/emsdk"
export PATH="$EMSDK:$EMSDK/upstream/emscripten:$EMSDK/node/22.14.1_64bit/bin:$EMSDK/python/3.13.3_64bit:$PATH"

LUAU="$(dirname "$0")/../roblox-external-executor-2b459ad80266ae18f58368000fdd98e71b298a0b/dependencies/luau"
ZSTD="$(dirname "$0")/zstd-1.5.6/lib"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OBJDIR="$SCRIPT_DIR/obj"
mkdir -p "$OBJDIR"

echo "Compiling ZSTD (C)..."
for f in "$ZSTD"/common/{debug,entropy_common,error_private,fse_decompress,xxhash,zstd_common,pool,threading}.c \
         "$ZSTD"/compress/{fse_compress,hist,huf_compress,zstd_compress,zstd_compress_literals,zstd_compress_sequences,zstd_compress_superblock,zstd_double_fast,zstd_fast,zstd_lazy,zstd_ldm,zstd_opt,zstdmt_compress}.c; do
    base=$(basename "$f" .c)
    emcc.bat -O2 -I"$ZSTD" -I"$ZSTD/common" -DXXH_NAMESPACE=ZSTD_ -DZSTD_MULTITHREAD=0 -c "$f" -o "$OBJDIR/${base}.o"
done

echo "Compiling Luau + entry (C++)..."
for f in "$LUAU"/src/{Allocator,Ast,BuiltinFolding,Builtins,BytecodeBuilder,Compiler,Confusables,ConstantFolding,CostModel,Cst,Lexer,Location,Parser,PrettyPrinter,StringUtils,TableShape,TimeTrace,Types,ValueTracking,lcode}.cpp \
         "$SCRIPT_DIR/wasm_entry.cpp"; do
    base=$(basename "$f" .cpp)
    emcc.bat -std=c++17 -O2 -I"$LUAU/include" -I"$LUAU/include/Luau" -I"$ZSTD" -c "$f" -o "$OBJDIR/${base}.o"
done

echo "Linking..."
emcc.bat \
    "$OBJDIR"/*.o \
    -O2 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_compile","_getResult","_getResultSize","_getError","_freeResult","_zstdCompress","_zstdBound","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8","HEAPU8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='LuauModule' \
    -s ENVIRONMENT='web' \
    -o "$SCRIPT_DIR/luau.js"

echo "Done!"
ls -lh "$SCRIPT_DIR/luau.js" "$SCRIPT_DIR/luau.wasm"
