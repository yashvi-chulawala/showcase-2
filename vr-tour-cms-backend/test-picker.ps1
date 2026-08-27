$app = New-Object -ComObject Shell.Application
$folder = $app.BrowseForFolder(0, "Select a Showcase 360 Project Folder", 0, 0)
if ($folder) {
    Write-Output $folder.Self.Path
}
