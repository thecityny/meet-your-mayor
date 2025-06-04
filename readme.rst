Looking for the most recent version? Head over to `Meet Your Mayor 2025 <https://github.com/thecityny/2025-meet-your-mayor>`_

Meet Your Mayor (2021)
======================================================

This news app is built on our `interactive template <https://github.com/thecityny/interactive-template>`_. Check the readme for that template for more details about the structure and mechanics of the app, as well as how to start your own project.

Getting started
---------------
**Please note this repo has not yet been optimized for easy customization and contains a number of hard-coded values. If you're interested in adapting the project, please send us an email at info@thecity.nyc.**

Sample document structure: `https://drive.google.com/drive/folders/1YXXWptOZ0JWQnrBwVori4D_-19Eq8YJC?usp=sharing`

To run this project you will need:

* Node installed (preferably with NVM or another version manager)
* The Grunt CLI (install globally with ``npm i -g grunt-cli``)
* Git

With those installed, you can then set the project up using your terminal:

#. Pull the code - ``git clone https://github.com/thecityny/meet-your-mayor.git``
#. Enter the project folder - ``cd meet-your-mayor``
#. Install dependencies from NPM - ``npm install``
#. Start the server - ``grunt``

Running tasks
-------------

Like all interactive-template projects, this application uses the Grunt task runner to handle various build steps and deployment processes. To see all tasks available, run ``grunt --help``. ``grunt`` by itself will run the "default" task, which processes data and starts the development server. However, you can also specify a list of steps as arguments to Grunt, and it will run those in sequence. For example, you can just update the JavaScript and CSS assets in the build folder by using ``grunt bundle less``.

Common tasks that you may want to run include:

* ``sheets`` - updates local data from Google Sheets
* ``docs`` - updates local data from Google Docs
* ``google-auth`` - authenticates your account against Google for private files
* ``static`` - rebuilds files but doesn't start the dev server
* ``cron`` - runs builds and deploys on a timer (see ``tasks/cron.js`` for details)
* ``publish`` - uploads files to the staging S3 bucket

  * ``publish:live`` uploads to production
  * ``publish:simulated`` does a dry run of uploaded files and their compressed sizes
