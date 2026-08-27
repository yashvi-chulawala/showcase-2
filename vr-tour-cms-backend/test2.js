const d = require('./lib/driveClient');
d.findByName('1w0crfj3IaOtzrQ5gsuBy50nlZA1whJHS', 'project-C:\\Users\\Yashvi Chulawala\\Downloads\\demo', true)
  .then(console.log)
  .catch(console.error);
