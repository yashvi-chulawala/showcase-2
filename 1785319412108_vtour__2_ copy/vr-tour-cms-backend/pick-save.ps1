param (
    [string]$Title = 'Save Project As'
)
Add-Type -AssemblyName System.windows.forms
$f = New-Object System.Windows.Forms.SaveFileDialog
$f.Title = $Title
$f.Filter = 'Project Folder|*.vtp'
$f.FileName = 'New Project'

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
$form.Activate()

if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    # Remove the .vtp extension that Windows might have appended
    $path = $f.FileName
    if ($path.EndsWith(".vtp")) {
        $path = $path.Substring(0, $path.Length - 4)
    }
    Write-Output $path
}
$form.Close()
