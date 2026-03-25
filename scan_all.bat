@echo off
set TOKEN=5dddc3cad92250beacfe1a9e55df9132d068ce78e3081444bfb206d471b4ea47

for %%t in (deepseek chatgpt claude) do (
    for %%s in (1 2 3 4 5 6 7 8 9 10) do (
        echo Scanning scenario%%s_%%t.js...
        docker run -e SEMGREP_APP_TOKEN=%TOKEN% --rm -v "%cd%:/src" semgrep/semgrep semgrep scan --json --output /src/scenario%%s_%%t.json /src/scenario%%s_%%t.js
    )
)

echo Done! All 30 files scanned.
```

This scans each `.js` file individually and saves the JSON result with the matching name. After running it you'll have 30 JSON files ready for the extract script.

Make sure all your `.js` files are named correctly in the same folder:
```
scenario1_deepseek.js
scenario1_chatgpt.js
scenario1_claude.js
...
scenario10_deepseek.js
scenario10_chatgpt.js
scenario10_claude.js