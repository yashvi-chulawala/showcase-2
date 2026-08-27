Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class FolderPicker {
    [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
    private class FileOpenDialogImpl {}

    [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileOpenDialog {
        [PreserveSig] uint Show([In] IntPtr hwndOwner);
        void SetOptions([In] uint fos);
        void GetResult([Out, MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
    }

    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem {
        void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
    }

    public static string GetFolder() {
        var dialog = (IFileOpenDialog)new FileOpenDialogImpl();
        dialog.SetOptions(32); // FOS_PICKFOLDERS
        uint hr = dialog.Show(IntPtr.Zero);
        if (hr == 0) {
            IShellItem item;
            dialog.GetResult(out item);
            string path;
            item.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
            return path;
        }
        return null;
    }
}
"@
[FolderPicker]::GetFolder()
