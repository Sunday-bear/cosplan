#!/usr/bin/env python3
import subprocess, json
result = subprocess.run(
    ['node', '-e', 'const acorn = require("acorn"); const fs = require("fs"); const code = fs.readFileSync("C:/Users/Administrator/.openclaw/workspace/cosplan/check_syntax_temp.js","utf-8"); try {acorn.parse(code,{ecmaVersion:2022});console.log("OK");} catch(e) {console.log(JSON.stringify({line:e.loc.line, col:e.loc.column, msg:e.message}));}'],
    capture_output=True, text=True)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr)
