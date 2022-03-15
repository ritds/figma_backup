const process = require('process');
const { spawn } = require('child_process')
const fs = require('fs/promises');
const path = require('path');
const downloadFigmaFiles = require('./download_figma_files_core')
const FigmaFilesListGetter = require('./get_figma_files_list_core')

// ========
// Settings
// ========

// Working directory
const working_dir_path= path.resolve('./process1')
const store_dir_path= path.resolve('./store1')

const downloads_dir_name = path.normalize(working_dir_path + '/_downloads')
const get_list_log_name = path.normalize(working_dir_path + '/get_figma_files_list_log.txt')
const download_log_name = path.normalize(store_dir_path + '/download_figma_files_log.txt')
const partial_lists_names = path.normalize(working_dir_path + '/figma_files_list*.json')

// Temporary directory
const tmp_dir_path = working_dir_path

// HTTP server directory
const http_server_dir_path = './figma'
const deduplicated_dir_name = 'deduplicated'
const stat_log_name = 'stats_log.txt'
const archive_dirs_to_keep = 30
const archive_dir_name_pattern = '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
const df_line_to_grep = '/dev/mapper/centos-root'

const args = process.argv.slice(2)
console.log('args', args)

// Other
const figma_login = args[0]
const figma_password = args[1]
// const current_date = `date +"%Y-%m-%d"`

// 
// if (!figma_login){
//     console.error("figma login needed")
//     process.exit(1)
// }
// 
// if (!figma_password){
//     console.error("figma password needed")
//     process.exit(1)
// }

// ========================
// Getting files from Figma
// ========================

// Coming to the working directory
// Remove files that may be kept since previous session
;
(async()=>{

    console.log('downloads_dir_name', working_dir_path)
    await fs.rm(working_dir_path, { recursive:true, force:true })
    await fs.mkdir(working_dir_path, { recursive:true })
    await fs.mkdir(store_dir_path, { recursive:true })

    const fileListGetter = new FigmaFilesListGetter()
    fileListGetter.perform()
})()

// .
// // Getting files list
// ./get_figma_files_list.py 2>&1 | tee ${get_list_log_name}
// 
// // Downloading files
// 
// list_names=`ls ${partial_lists_names}`
// 

// downloadFigmaFiles()

// for list_name in ${list_names} ; do
//     echo -e "\n\nProcessing the file ${list_name}\n\n"
//     node ./download_figma_files.js "figmaLogin=${figma_login}" "figmaPassword=${figma_password}" "figmaFilesList=./${list_name}" "settingFile=./config/download_settings.json" 2>&1 
//     cp -rf ./${downloads_dir_name}/* ${store_dir_path}/
//     sleep 30
// done
// 
// echo 'DONE'