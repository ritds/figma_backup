#!/bin/bash

set -eo pipefail

partial_lists_names='./process/figma_files_list*.json'
store_dir_path='./store'

list_names=`ls ${partial_lists_names}`

# Other
figma_login=$1
figma_password=$2

if [ -z $figma_login ] 
    then
    echo "figma login needed"
    exit 1
fi

if [ -z $figma_password ] 
    then
    echo "figma password needed"
    exit 1
fi

for list_name in ${list_names} ; do
    echo -e "\n\nProcessing the file ${list_name}\n\n"
    node ./figma_download_files_by_list.js "figmaLogin=${figma_login}" "figmaPassword=${figma_password}" "figmaFilesList=./${list_name}" 2>&1 
    sleep 30
done
