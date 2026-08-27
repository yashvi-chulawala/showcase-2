param (
    [string]$Title = 'Select Project Folder'
)
Add-Type -AssemblyName System.windows.forms
$f = New-Object System.Windows.Forms.OpenFileDialog
$f.ValidateNames = $false
$f.CheckFileExists = $false
$f.CheckPathExists = $true
$f.FileName = 'Select Folder'
$f.Title = $Title
$f.Filter = 'Folders|*.none'

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
$form.Activate()

if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output (Split-Path $f.FileName)
}
$form.Close()
