const d = require('./lib/driveClient');
d.listFiles('1w0crfj3IaOtzrQ5gsuBy50nlZA1whJHS', "mimeType = 'application/vnd.google-apps.folder' and name = 'project-C:\\\\Users\\\\Yashvi Chulawala\\\\Downloads\\\\demo'")
  .then(files => {
    if(files.length > 0) {
      console.log('Deleting', files[0].id);
      return d.deleteFile(files[0].id);
    }
    console.log('Not found');
  })
  .then(() => console.log('Done'))
  .catch(console.error);
