param (
    [string]$Title = 'Save Project As'
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.windows.forms
$f = New-Object System.Windows.Forms.SaveFileDialog
$f.Title = $Title
$f.Filter = 'Showcase 360 Project (*.s360)|*.s360'
$f.FileName = 'New Project'

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
$form.Activate()

if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    # Remove the .s360 extension that Windows might have appended
    $path = $f.FileName
    if ($path.EndsWith(".s360")) {
        $path = $path.Substring(0, $path.Length - 5)
    }
    Write-Output $path
}
$form.Close()
