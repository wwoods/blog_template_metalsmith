import {SiteMetadata} from './plugin/site-config';
import {TagPluginConfig} from './plugin/tagging-and-dates';

export const siteMetadata:SiteMetadata = {
  sitename: "Example Site",
  author: "Walt Woods",
};

export const tagConfig:TagPluginConfig = {
  "dateFields": {
    //Fields that should be converted to javascript Date objects.
    //tag: If true, tag anything with this date as ${tagPrefix}-yyyy-mm-dd.
    "date": {
      "tag": true
    },
    "mdate": {
      "tag": true,
      "tagPrefix": "modified"
    }
  },
  "folders": [
    //Special instructions on a per-folder basis.  First match is only one that
    //applies.  A future version of this template might relegate this part of
    //the config to index.pug files that affect all files under that folder.
    //Options:
    //  tags: Array of tags to apply to all matching files.
    //  dateField: Field to put Date object in for folders with name like
    //      path/to/yyyy-mm/dd-title...
    [["blog-help/**/*.pug"], {"tags": ["blog-help"]}],
    [["**/*.pug"], {"dateField": "date"}]
  ],
  "tagHierarchy": [
    //Tags are inherently flat.  That is, each tag name is unique without
    //regard to hierarchy.  However, this array allows specifying where
    //different tags are nested when searching tags.  It also implies a
    //superset relationship: blog/blog-help implies that all items tagged
    //blog-help should be implicitly tagged as blog.
    "blog/blog-help",
    "blog/metalsmith",
    "every/body",
    "metalsmith",
    "test/there/example"
  ],
  "tagSettings": {
    //Each tag default sorts by ["date", "title"].  This section allows
    //overriding that on a per-tag basis.  Hierarchy applies.
    "blog-help": { "sort": ["title"] },
    "modified": { "sort": ["mdate", "date"] }
  }
};
