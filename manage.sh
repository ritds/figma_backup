#!/bin/bash

set -eo pipefail



# ========
# Settings
# ========

# Working directory
#working_dir_path='/home/gitlab-runner/figma_files_retriever'
working_dir_path='./work'
downloads_dir_name='_downloads'
get_list_log_name='get_figma_files_list_log.txt'
download_log_name='download_figma_files_log.txt'
partial_lists_names='figma_files_list*.json'


# Temporary directory
#tmp_dir_path='/home/gitlab-runner/tmp/figma_files'
tmp_dir_path='./work/tmp'


# HTTP server directory
http_server_dir_path='./figma'
#http_server_dir_path='/var/www/figma.docs.restream.ru'
deduplicated_dir_name='deduplicated'
stat_log_name='stats_log.txt'
archive_dirs_to_keep=30
archive_dir_name_pattern='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
df_line_to_grep='/dev/mapper/centos-root'


# Other
figma_login='your_figma_login'
figma_password='your_figma_password'
current_date=`date +"%Y-%m-%d"`



# ========================
# Getting files from Figma
# ========================

# Coming to the working directory
cd ${working_dir_path}/


# Remove files that may be kept since previous session
rm -rf ./${downloads_dir_name}/ ./${get_list_log_name} ./${partial_lists_names} ./${download_log_name} ${tmp_dir_path}/${current_date}/ ${http_server_dir_path}/${current_date}/

pwd

# Getting files list
./../get_figma_files_list.py 2>&1 | tee ./${get_list_log_name}


# Creating the directory that refers to current date in the temporary directory
mkdir -p ${tmp_dir_path}/${current_date}/


# Downloading files

list_names=`ls ${partial_lists_names}`

for list_name in ${list_names} ; do
    echo -e "\n\nProcessing the file ${list_name}\n\n" | tee -a ./${download_log_name}
    # docker-compose build
    # echo -e "run --user=$(id -u):$(id -g) --rm figma ${figma_login} ${figma_password} /usr/src/app/${list_name} /usr/src/app/${downloads_dir_name}/ 2>&1"
    node ./../download_figma_files.js "${figma_login}" "${figma_password}" ./${list_name} ./${downloads_dir_name}/ 2>&1 
    #| tee -a ./${download_log_name}
    # docker-compose run --user="$(id -u):$(id -g)" --rm figma "${figma_login}" "${figma_password}" /usr/src/app/${list_name} /usr/src/app/${downloads_dir_name}/ 2>&1 | tee -a ./${download_log_name}
    #docker-compose run --rm figma "${figma_login}" "${figma_password}" /usr/src/app/${list_name} /usr/src/app/${downloads_dir_name}/ 2>&1 | tee -a ./${download_log_name}
    cp -r ./${downloads_dir_name}/* ${tmp_dir_path}/${current_date}/
    rm -rf ./${downloads_dir_name}/
    sleep 30
done


# Moving logs to the directory with downloaded files
mv ./${get_list_log_name} ${tmp_dir_path}/${current_date}/
mv ./${download_log_name} ${tmp_dir_path}/${current_date}/


# Moving downloaded files from the temporary directory to the HTTP server directory
mv ${tmp_dir_path}/${current_date}/ ${http_server_dir_path}/${current_date}/



# =========================
# Deduplicating and cleanup
# =========================

# Deduplicating files
#./../deduplicate.py ${http_server_dir_path}/${current_date}/ ${http_server_dir_path}/${deduplicated_dir_name}/


# Getting full list of archive directories sorted by date descending
archive_dirs=`ls -dt ${http_server_dir_path}/${archive_dir_name_pattern}/`


# Deleting older archive directories

deleted_dirs=0
deleted_files=0
i=0

# for archive_dir in ${archive_dirs} ; do
#     i=$((i+1))

#     if [[ "${i}" -gt "${archive_dirs_to_keep}" ]]; then
#         echo "${archive_dir} has position ${i} and will be deleted"
#         deleted_dirs=$((deleted_dirs+1))
#         rm -rf ${archive_dir}
#     else
#         echo "${archive_dir} has position ${i} and will be kept"
#     fi
# done


# Deleting archive files that have no links

#archive_files=`ls ${http_server_dir_path}/${deduplicated_dir_name}/*.fig`

# for archive_file in ${archive_files} ; do
#     links_count=`find -L ${http_server_dir_path}/${archive_dir_name_pattern}/ -samefile ${archive_file} | wc -l`

#     if [[ "${links_count}" -eq 0 ]]; then
#         echo "${archive_file} has ${links_count} links and will be deleted"
#         deleted_files=$((deleted_files+1))
#         rm -rf ${archive_file}
#     else
#         echo "${archive_file} has ${links_count} links and will be kept"
#     fi
# done


# Copying older symlinks to the actual directory

#previous_dir=`ls -dt ${http_server_dir_path}/${archive_dir_name_pattern}/ | head -n 2 | tail -n 1`
#cp -rn ${previous_dir}/* ${http_server_dir_path}/${current_date}/



# =============================
# Writing statistics to the log
# =============================

#set +e

#echo -e "Report date\n${current_date}" > ${http_server_dir_path}/${stat_log_name}
#echo -e "\nTotal disk usage" >> ${http_server_dir_path}/${stat_log_name}
#df -h | grep ${df_line_to_grep} >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nDisk usage by this backup" >> ${http_server_dir_path}/${stat_log_name}
#du -sh ${http_server_dir_path}/ >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nTotal files saved" >> ${http_server_dir_path}/${stat_log_name}
#ls ${http_server_dir_path}/${deduplicated_dir_name}/*.fig | wc -l >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nFiles last listed" >> ${http_server_dir_path}/${stat_log_name}
#grep "\"key\": " ./${partial_lists_names} | wc -l >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nFiles last downloaded" >> ${http_server_dir_path}/${stat_log_name}
#grep 'Download complete' ${http_server_dir_path}/${current_date}/${download_log_name} | wc -l >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nFiles last not downloaded because of being protected" >> ${http_server_dir_path}/${stat_log_name}
#grep 'This file is protected against saving locally and sharing' ${http_server_dir_path}/${current_date}/${download_log_name} | wc -l >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nDeleted archive directories\n${deleted_dirs}" >> ${http_server_dir_path}/${stat_log_name}
#echo -e "\nDeleted archive files\n${deleted_files}" >> ${http_server_dir_path}/${stat_log_name}
echo 'DONE'