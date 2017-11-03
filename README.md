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

New Site for Empty Repository
-----------------------------

The `update-cwd.sh` script is used by changing to a new directory or existing directory that is a version of this blog template and has not significantly diverged.

To create a new, empty website following this template, follow these steps:

    $ git clone https://github.com/wwoods/blog_template_metalsmith
    $ git init new_repo
    $ cd new_repo
    $ ../blog_template_metalsmith/update-cwd.sh
    $ npm start

The command `update-cwd.sh` will copy all needed files.

Updating a Site From This Repository
------------------------------------

Assuming a repository that began as a fork (or via `update-cwd.sh`) of this template, that fork may be updated by cloning this repository and running its `update-cwd.sh` with the repository to be updated as the current working directory.

When differentiating between an update and creating a new site, this script only checks for the existence of "index.ts".

