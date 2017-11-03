set -e
# Script intended to either CREATE a new site based on this template but with
# no content, or to UPDATE a site that follows this template very closely (has
# not changed index.ts, base layouts, base plugins, etc).
stat ${TEMPLATE} >/dev/null 2>&1 || (echo "Could not find path indicated by TEMPLATE environment variable: ${TEMPLATE}" && exit 1)
EXISTS=$(stat ./index.ts >/dev/null 2>&1 && echo 1 || echo 0)

if [ "${EXISTS}" -eq "1" ]; then
    echo "Updating core site files from TEMPLATE=${TEMPLATE}"
    cp --preserve=timestamps -r ${TEMPLATE}/.gitignore ${TEMPLATE}/index.ts ${TEMPLATE}/layouts ${TEMPLATE}/package.json ${TEMPLATE}/plugin ${TEMPLATE}/tsconfig.json ${TEMPLATE}/update.sh ./
    cp --preserve=timestamps ${TEMPLATE}/content/styleDefault.scss ./content/styleDefault.scss
else
    echo "Making NEW SITE from TEMPLATE=${TEMPLATE}"
    cp --preserve=timestamps -r ${TEMPLATE}/*.ts ${TEMPLATE}/package.json ${TEMPLATE}/layouts ${TEMPLATE}/plugin ${TEMPLATE}/tsconfig.json ${TEMPLATE}/update.sh ${TEMPLATE}/.gitignore ./
    mkdir content
    cp --preserve=timestamps -r ${TEMPLATE}/content/styleDefault.scss ${TEMPLATE}/content/reset.css ./content
fi

