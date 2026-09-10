[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.windows.forms

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Select a Showcase 360 Project Folder (Enter the folder and click Open)"
$dialog.ValidateNames = $false
$dialog.CheckFileExists = $false
$dialog.CheckPathExists = $true
$dialog.FileName = "Folder Selection"

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Show()
$form.Activate()

if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    $path = $dialog.FileName
    if ($path.EndsWith("Folder Selection")) {
        $path = $path.Substring(0, $path.Length - 16)
    }
    # Also handle if they picked a file inside the folder
    $path = [System.IO.Path]::GetDirectoryName($path)
    Write-Output $path
}
$form.Close()
