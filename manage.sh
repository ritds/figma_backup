#!/bin/bash

set -eo pipefail



# ========
# Settings
# ========

# Working directory
#working_dir_path='/home/gitlab-runner/figma_files_retriever'
working_dir_path='./process'
store_dir_path='./store'

downloads_dir_name=${working_dir_path}'/_downloads'
get_list_log_name=${working_dir_path}'/get_figma_files_list_log.txt'
download_log_name=${store_dir_path}'/download_figma_files_log.txt'
partial_lists_names=${working_dir_path}'/figma_files_list*.json'


# Temporary directory
#tmp_dir_path='/home/gitlab-runner/tmp/figma_files'
tmp_dir_path=$working_dir_path


# HTTP server directory
http_server_dir_path='./figma'
#http_server_dir_path='/var/www/figma.docs.restream.ru'
deduplicated_dir_name='deduplicated'
stat_log_name='stats_log.txt'
archive_dirs_to_keep=30
archive_dir_name_pattern='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
df_line_to_grep='/dev/mapper/centos-root'


# Other
figma_login=$1
figma_password=$2
current_date=`date +"%Y-%m-%d"`

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


# ========================
# Getting files from Figma
# ========================

# Coming to the working directory
# Remove files that may be kept since previous session
rm -rf ${working_dir_path}
mkdir -p ${working_dir_path}/
mkdir -p ${store_dir_path}/
touch ${working_dir_path}/download_errors.txt


# Getting files list
./get_figma_files_list.py 2>&1 | tee ${get_list_log_name}


# Downloading files

list_names=`ls ${partial_lists_names}`

for list_name in ${list_names} ; do
    echo -e "\n\nProcessing the file ${list_name}\n\n"
    node ./download_figma_files.js "figmaLogin=${figma_login}" "figmaPassword=${figma_password}" "figmaFilesList=./${list_name}" "settingFile=./config/download_settings.json" 2>&1 
    cp -rf ./${downloads_dir_name}/* ${store_dir_path}/
    sleep 30
done

if [ -s ${working_dir_path}/download_errors.txt ]; then
        echo -e "\n\nCan't download files:"
        cat ${working_dir_path}/download_errors.txt
fi

echo -e "\n\nDONE"