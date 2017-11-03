Blog Template for Metalsmith
============================

General information organization and presentation framework.

All content goes under "content" folder.  The file system hierarchy is stored and presented as "attachments", and additionally each content file (named \*.pug, as this framework uses the [Pug](https://pugjs.org/api/getting-started.html) template engine) can have tags associated with it.

The file `indexConfig.ts` contains configuration settings for how tags should be displayed and organized.  Each tag can have zero or more parent tags - that is, tags form a directed graph (may be cyclic).

Installation / Getting Started
------------------------------

1. Install [node.js](nodejs.org).
2. Clone this repository.
3. cd to the directory, and run:

       $ npm install
       $ npm start

4. Point your browser at http://127.0.0.1:8080

New Page from Empty Repo
------------------------

The update.sh script will update any version of this website that has not significantly diverged.  Additionally, it may be used to create a new, empty website following this website's template.  Follow these steps:

    $ git clone https://github.com/wwoods/blog_template_metalsmith
    $ git init new_repo
    $ cd new_repo
    $ TEMPLATE=../blog_template_metalsmith ../blog_template_metalsmith/update.sh
    $ npm install
    $ npm start

That command will copy all needed files.  It only checks for the existence of "index.ts", and is not suitable for existing repositories.  Blank ones only!

