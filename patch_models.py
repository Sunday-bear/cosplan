#!/usr/bin/env python3
# Patch: move model loading to page load, add progress feedback

import httpx, re

# Get the current fixed version from workspace
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    script = f.read()

# 1. Replace the `loadModels` function - remove loading overlay, start immediately
old_load = '''async function loadModels() {
  if (modelsLoaded) return true;
  showLoading('加载AI模型...');
  try {
    let waited = 0;
    while (typeof faceapi === 'undefined') {
      if (waited++ > 40) throw new Error('face-api.js \u52a0\u8f7d\u8d85\u65f6');
      await new Promise(r => setTimeout(r, 500));
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    hideLoading();
    return true;
  } catch(e) {
    hideLoading();
    console.error(e);
    showToast('😕 \u5206\u6790\u51fa\u9519\uff0c\u8bf7\u91cd\u8bd5');
  }
  hideLoading();
});'''

new_load = '''var modelLoadProgress = 0;
var modelLoadMax = 5;
var modelLoadStatus = '';

function updateModelStatus(msg) {
  modelLoadStatus = msg;
  // Update the toast if it's showing
  var t = document.getElementById('toast');
  if (t && t.classList.contains('show')) {
    t.textContent = msg;
  }
}

async function loadModels() {
  if (modelsLoaded) return true;
  try {
    var waited = 0;
    while (typeof faceapi === 'undefined') {
      if (waited++ > 40) throw new Error('face-api.js \u52a0\u8f7d\u8d85\u65f6');
      await new Promise(function(r) { setTimeout(r, 500); });
    }
    modelLoadProgress = 1;
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelLoadProgress = 2;
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    modelLoadProgress = 3;
    modelsLoaded = true;
    return true;
  } catch(e) {
    console.error('Model load error:', e);
    return false;
  }
}

// Start loading models when page loads (the first idle moment)
setTimeout(function() {
  // Don't await - let it run in background
  loadModels().then(function(ok) {
    if (ok) {
      console.log('Models loaded in background \u2705');
    }
  });
}, 100);
'''

# Check if we can find the old pattern
if 'async function loadModels()' in script:
    print('Found loadModels function')
    # Find boundaries - from 'async function loadModels' to the next function declaration
    start = script.find('async function loadModels()')
    # Find the function block - look for the closing } before next function
    # The current loadModels ends with 'hideLoading();' then a bare '})();' or similar
    # Let's find it by scope
    depth = 0
    brace_start = -1
    brace_end = -1
    for i, ch in enumerate(script[start:]):
        if ch == '{':
            depth += 1
            if brace_start < 0: brace_start = i
        elif ch == '}':
            depth -= 1
            if depth == 0:
                brace_end = i + 1
                break
    if brace_end > 0:
        old_block = script[start:start+brace_end]
        print(f'loadModels block: {len(old_block)} chars, starts at {start}')
        # But we need to find where it ends... the current block includes some trailing code
        script = script[:start] + new_load + script[start+brace_end:]
        print('Replaced loadModels function')
    else:
        print('Could not find brace boundaries')
else:
    print('loadModels function NOT FOUND in fixed script!')

# 2. Modify displayCapturedImage to trigger analysis automatically after upload
# Find the function
old_display = '''function displayCapturedImage(img) {'''
new_display = '''function displayCapturedImage(img) {
  // Check if models are already loaded - if so, analyze immediately
  if (modelsLoaded) {
    setTimeout(function() {
      if (typeof loadModels !== 'undefined') {
        document.getElementById('btnAnalyze').click();
      }
    }, 100);
  } else {
    // Show a hint that analysis will happen once models are ready
    showToast('AI \u6a21\u578b\u52a0\u8f7d\u4e2d\uff0c\u7a0d\u540e\u81ea\u52a8\u5206\u6790...');
  }'''

script = script.replace(old_display, new_display)

# 3. Add model check in the analyze button click handler
# Find it - it's the async addEventListener click
old_analyze = '''document.getElementById('btnAnalyze').addEventListener('click', async () => {'''
new_analyze = '''document.getElementById('btnAnalyze').addEventListener('click', async function() {
  // Make sure models are loaded
  if (!modelsLoaded) {
    var ok = await loadModels();
    if (!ok) {
      showToast('AI\u6a21\u578b\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762');
      return;
    }
  }'''

script = script.replace(old_analyze, new_analyze)

# 4. Rewrite the while-loop waiting pattern in diagnose
# In diagnose function, there's a wait for loadModels then load face-api models
old_await_models = '''await loadModels();

    // Load face-api model for this specific analysis'''

new_await_models = '''if (!modelsLoaded) {
      var ok = await loadModels();
      if (!ok) {
        hideLoading();
        showToast('\u6a21\u578b\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762');
        return;
      }
    }

    // Load face-api model for this specific analysis'''

script = script.replace(old_await_models, new_await_models)

# Save the patched script
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'w', encoding='utf-8') as f:
    f.write(script)

# Verify
print(f'Script length: {len(script)}')

# Check if it parses
import subprocess
result = subprocess.run(['node', '--check', r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js'], capture_output=True, text=True)
if result.returncode == 0:
    print('Syntax check OK!')
else:
    print(f'Syntax error: {result.stderr[:200]}')
