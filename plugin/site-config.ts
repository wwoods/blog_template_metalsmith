
export interface SiteMetadata {
  sitename:string;
  author:string;

  //User-site-specific metadata
  [otherProperty:string]: any;
}

