import {TagPluginConfig} from './plugin/tagging-and-dates';

export const config:TagPluginConfig = {
  "dateFields": {
    "date": {
      "tag": true
    },
    "mdate": {
      "tag": true,
      "tagPrefix": "modified"
    }
  },
  "folders": [
    [["blog-help/**/*.pug"], {"tags": ["blog-help"]}],
    [["**/*.pug"], {"dateField": "date"}]
  ],
  "tagHierarchy": [
    "blog/blog-help",
    "blog/metalsmith",
    "every/body",
    "metalsmith",
    "test/there/example"
  ],
  "tagSettings": {
    "blog-help": { "sort": ["title"] },
    "modified": { "sort": ["mdate", "date"] }
  }
};
