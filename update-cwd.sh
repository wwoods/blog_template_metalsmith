# This script either:
# CREATES a new site based on this template but with no content.
# UPDATES an existing site that follows this template very closely (has not
#     changed index.ts, base layouts, base plugins, etc).

set -e

# Find directory of THIS script, regardless of current working directory.
pushd `dirname $0` > /dev/null
TEMPLATE="$( cd "$(dirname "$(readlink -f "$0")")" ; pwd -P )"
popd > /dev/null

EXISTS=$(stat ./index.ts >/dev/null 2>&1 && echo 1 || echo 0)
if [ "${EXISTS}" -eq "1" ]; then
    echo "Updating core site files from TEMPLATE=${TEMPLATE}"
    cp --preserve=timestamps -r ${TEMPLATE}/.gitignore ${TEMPLATE}/index.ts ${TEMPLATE}/layouts ${TEMPLATE}/package.json ${TEMPLATE}/plugin ${TEMPLATE}/tsconfig.json ./
    cp --preserve=timestamps ${TEMPLATE}/contents/styleDefault.scss ./contents/styleDefault.scss
    npm install
else
    echo "Making NEW SITE from TEMPLATE=${TEMPLATE}"
    cp --preserve=timestamps -r ${TEMPLATE}/*.ts ${TEMPLATE}/package.json ${TEMPLATE}/layouts ${TEMPLATE}/plugin ${TEMPLATE}/tsconfig.json ${TEMPLATE}/.gitignore ./
    mkdir ./contents
    cp --preserve=timestamps -r ${TEMPLATE}/contents/styleDefault.scss ${TEMPLATE}/contents/reset.css ./contents
    npm install
fi

