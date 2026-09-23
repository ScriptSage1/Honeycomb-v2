# Local file mode

Stop the existing web server with Ctrl+C, then run this from the project folder:

```powershell
pnpm dsh web --patch local-files.patch.yml --port 4174 --no-open
```

Open the complete URL printed by that command. Select your Ollama model and start a new conversation in the workspace where you want files created. This mode exposes only `read`, `write`, and `edit`; workspace permissions still apply. These tools accept file paths, not directory-listing requests.

Try: “Create hello.py in the current workspace containing print('hello'), then read it back.” Use the current workspace rather than a different Desktop or Downloads folder.

The scheduler now uses a process-wide key, preventing separate module instances from producing the `undefined (reading 'prepare')` failure. Source and built CLI regression tests create, read, edit, and verify a temporary file. A live local qwen3.5:9b run also verified the edited file on disk.

Validation: full build passed; source/built file tests passed; 355 tool/filesystem tests passed. One additional containment test could not create a symbolic link because Windows returned EPERM.
