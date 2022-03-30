#!/bin/bash

set -eo pipefail

working_dir_path='./process'
store_dir_path='./store'

downloads_dir_name=${working_dir_path}'/_downloads'
get_list_log_name=${working_dir_path}'/get_figma_files_list_log.txt'
download_log_name=${store_dir_path}'/download_figma_files_log.txt'
partial_lists_names=${working_dir_path}'/figma_files_list*.json'

tmp_dir_path=$working_dir_path
http_server_dir_path='./figma'

current_date=`date +"%Y-%m-%d"`

rm -rf ${working_dir_path}
mkdir -p ${working_dir_path}/
mkdir -p ${store_dir_path}/

./get_figma_files_list.py 2>&1 | tee ${get_list_log_name}