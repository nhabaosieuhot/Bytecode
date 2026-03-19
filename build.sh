#!/bin/bash
set -e

EMSDK="$HOME/emsdk"
export PATH="$EMSDK:$EMSDK/upstream/emscripten:$EMSDK/node/22.14.1_64bit/bin:$EMSDK/python/3.13.3_64bit:$PATH"

LUAU="$(dirname "$0")/../roblox-external-executor-2b459ad80266ae18f58368000fdd98e71b298a0b/dependencies/luau"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

SRCS=(
    "$LUAU/src/Allocator.cpp"
    "$LUAU/src/Ast.cpp"
    "$LUAU/src/BuiltinFolding.cpp"
    "$LUAU/src/Builtins.cpp"
    "$LUAU/src/BytecodeBuilder.cpp"
    "$LUAU/src/Compiler.cpp"
    "$LUAU/src/Confusables.cpp"
    "$LUAU/src/ConstantFolding.cpp"
    "$LUAU/src/CostModel.cpp"
    "$LUAU/src/Cst.cpp"
    "$LUAU/src/Lexer.cpp"
    "$LUAU/src/Location.cpp"
    "$LUAU/src/Parser.cpp"
    "$LUAU/src/PrettyPrinter.cpp"
    "$LUAU/src/StringUtils.cpp"
    "$LUAU/src/TableShape.cpp"
    "$LUAU/src/TimeTrace.cpp"
    "$LUAU/src/Types.cpp"
    "$LUAU/src/ValueTracking.cpp"
    "$LUAU/src/lcode.cpp"
    "$SCRIPT_DIR/wasm_entry.cpp"
)

echo "Building Luau compiler WASM..."
emcc.bat \
    "${SRCS[@]}" \
    -I"$LUAU/include" \
    -I"$LUAU/include/Luau" \
    -std=c++17 \
    -O2 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_compile","_getResult","_getResultSize","_getError","_freeResult","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='LuauModule' \
    -s ENVIRONMENT='web' \
    -o "$SCRIPT_DIR/luau.js"

echo "Done! Output: luau.js + luau.wasm"
ls -lh "$SCRIPT_DIR/luau.js" "$SCRIPT_DIR/luau.wasm"
