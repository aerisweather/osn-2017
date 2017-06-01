#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
cd ${DIR};
echo "Starting presentation web server";
echo "http://localhost:8000/slideshow.html";
python3 -m http.server