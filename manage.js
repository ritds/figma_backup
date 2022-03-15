const process = require('process');
const { spawn } = require('child_process')
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const downloadFigmaFiles = require('./download_figma_files_core')
const FigmaFilesListGetter = require('./get_figma_files_list_core')

// ========
// Settings
// ========

// Working directory
const working_dir_path= path.resolve('./process')
const store_dir_path= path.resolve('./store')

const downloads_dir_name = path.normalize(working_dir_path + '/_downloads')
const get_list_log_name = path.normalize(working_dir_path + '/get_figma_files_list_log.txt')
const download_log_name = path.normalize(store_dir_path + '/download_figma_files_log.txt')
// const partial_lists_names = path.normalize(working_dir_path + '/figma_files_list*.json')

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

if (!figma_login){
    console.error("figma login needed")
    process.exit(1)
}

if (!figma_password){
    console.error("figma password needed")
    process.exit(1)
}

// ========================
// Getting files from Figma
// ========================

// Coming to the working directory
// Remove files that may be kept since previous session
;
(async()=>{

    // await fsPromises.rm(working_dir_path, { recursive:true, force:true })
    // await fsPromises.mkdir(working_dir_path, { recursive:true })
    // await fsPromises.mkdir(store_dir_path, { recursive:true })

    // Getting files list
    // const fileListGetter = new FigmaFilesListGetter()
    // fileListGetter.perform()

    var files = fs.readdirSync(working_dir_path)
        .filter(fn => fn.startsWith('figma_files_list')&&fn.endsWith('.json'))
        .map(fn=>path.join(working_dir_path, fn));
    console.log('list files', files)
    for(let i in files){
        const list_name = files[i]
        console.log(`\n\nProcessing the file ${list_name}\n\n`)
        await downloadFigmaFiles({
            figmaFilesListFile:list_name,
            figmaLogin:figma_login,
            figmaPassword:figma_password,
        })
//     cp -rf ./${downloads_dir_name}/* ${store_dir_path}/
//     sleep 30
    }
// 
// echo 'DONE'

})()
