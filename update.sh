set -e
echo "Updating core site files from TEMPLATE=${TEMPLATE}"
stat ${TEMPLATE} >/dev/null 2>&1 || (echo "Could not find path indicated by TEMPLATE environment variable: ${TEMPLATE}" && exit 1)
cp --preserve=timestamps -r ${TEMPLATE}/index.ts ${TEMPLATE}/layouts ${TEMPLATE}/package.json ${TEMPLATE}/plugin ${TEMPLATE}/tsconfig.json ${TEMPLATE}/update.sh ./
cp --preserve=timestamps ${TEMPLATE}/content/styleDefault.scss ./content/styleDefault.scss

