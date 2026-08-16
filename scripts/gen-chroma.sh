#!/usr/bin/env bash
set -e

LIGHT=$(grep 'chromaStyleLight' hugo.toml | sed -E 's/.*=\s*"(.*)"/\1/')
DARK=$(grep 'chromaStyleDark' hugo.toml | sed -E 's/.*=\s*"(.*)"/\1/')

echo "Светлая тема кода: $LIGHT"
echo "Тёмная тема кода:  $DARK"

OUT_DIR="themes/mytheme/assets/css"

hugo gen chromastyles --style="$LIGHT" > "$OUT_DIR/chroma-light.css"
hugo gen chromastyles --style="$DARK" > "$OUT_DIR/chroma-dark.css"

# Простая глобальная замена — .chroma у Chroma всегда самостоятельный токен,
# независимо от того, что стоит перед ним на строке (комментарий, запятая, начало строки)
sed -i 's/\.chroma/[data-theme="light"] .chroma/g' "$OUT_DIR/chroma-light.css"
sed -i 's/\.chroma/[data-theme="dark"] .chroma/g' "$OUT_DIR/chroma-dark.css"

echo "Готово: $OUT_DIR/chroma-light.css и chroma-dark.css обновлены."