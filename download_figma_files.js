#!/usr/bin/node


// Command line arguments

const figmaLogin = process.argv[2];
const figmaPassword = process.argv[3];
const figmaFilesListFile = process.argv[4];
const downloadsBaseDir = process.argv[5];
let debugDir = process.argv[6];

if(!figmaLogin || !figmaPassword || !downloadsBaseDir)
{
    console.log('Usage: <script_name> <figma_login> <figma_password> <figma_files_list_file> <downloads_base_dir> [<debug_dir>]');
    process.exit(1);
}


// Using 'fs'
const fs = require('fs');


// Checking if downloads base directory exists

fs.access(downloadsBaseDir, (err) => {
    if (!err) {
        console.log('Downloads base directory must not exist');
        process.exit(1);
    }
});


// Creating the directory for debug purposes

if(debugDir) {
    if(!debugDir.endsWith('/')) {
        debugDir += '/';
    }

    fs.mkdirSync(debugDir, {recursive: true});

    console.log('Working in debug mode; content and screenshots of the file pages will be saved to the directory: ' + debugDir + '\n');
}


// Reading Figma files list file

let figmaFilesList;

fs.readFile(figmaFilesListFile, (err, data) => {
    if(err) throw err;
    figmaFilesList = JSON.parse(data);
});


// Login page settings
const loginPageUrl = 'https://www.figma.com/login';
const usernameSelector = 'input[name="email"]';
const passwordSelector = 'input[name="password"]';
const buttonSelector = 'button[type="submit"]';


// After-login page settings
const filebrowserSelector = '#filebrowser-loading-page';


// File page settings
const filePageBaseUrl = 'https://www.figma.com/file/';
const fullscreenFilenameSelector = '#fullscreen-filename';


// Using Puppeteer

const puppeteer = require('puppeteer');

(async() => {
    // Launching Chrome
    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox'], timeout: 120000});
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(180000);

    try {
        // Opening the login page
        console.log('Opening the login page');
        await page.goto(loginPageUrl, {waitUntil: 'networkidle2'});


        // Filling the email field
        console.log('Filling the email field');
        await page.focus(usernameSelector, {delay: 500});
        await page.keyboard.type(figmaLogin);


        // Filling the password field
        console.log('Filling the password field');
        await page.focus(passwordSelector, {delay: 500});
        await page.keyboard.type(figmaPassword);


        // Clicking the submit button
        console.log('Clicking the submit button');
        await page.click(buttonSelector, {delay: 500});
        console.log('Waiting for an after-login page opening');


        // Sleeping for 10 seconds
        await sleep(10000);


        // Waiting for an after-login page loading
        await page.waitForSelector(filebrowserSelector);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }


    // Processing Figma files

    for(let i = 0; i < figmaFilesList.length; i++) {
        console.log('\nStarting to process new file (' + (i + 1) + '/' + figmaFilesList.length + '), key: ' + figmaFilesList[i].key);

        try {
            // Opening an empty page
            console.log('Opening an empty page');
            await page.goto('about:blank');


            // Sleeping for 3 seconds
            await sleep(3000);


            // Opening a file page
            let filePage = filePageBaseUrl + figmaFilesList[i].key + '/';
            console.log('Opening the file page: ' + filePage);
            let filePageResponse = await page.goto(filePage, {waitUntil: 'networkidle2'});


            // Checking status code

            console.log('Returned status: ' + filePageResponse.status());

            if(filePageResponse.status() !== 200) {
                console.log('Skipping the file');
            } else {
                // Sleeping for 10 seconds, waiting for a specific element in React-generated content
                await sleep(10000);
                await page.waitForSelector(fullscreenFilenameSelector);


                // Checking if the file is available to save locally

                let content = await page.content();

                if(!content.includes('="Viewers can\'t copy or share this file."')) {
                    // Getting and validating page title

                    title = await page.title();
                    console.log("Page title: '" + title + "'");

                    if(title.endsWith(' – Figma')) {
                        // Getting the local path of the directory for the file to download

                        let downloadDir = downloadsBaseDir;

                        if(!downloadDir.endsWith('/')) {
                            downloadDir += '/';
                        }

                        if(figmaFilesList[i].team) {
                            downloadDir += 'TEAM ' + figmaFilesList[i].team + '/';
                        }

                        if(figmaFilesList[i].project) {
                            downloadDir += 'PROJECT ' + figmaFilesList[i].project + '/';
                        }

                        console.log("Directory to save the file: '" + downloadDir + "'");

                        fs.mkdirSync(downloadDir, {recursive: true});

                        let beforeDownloadFilesNumber = fs.readdirSync(downloadDir).length;


                        // Set download behavior
                        await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadDir});


                        // Debug: making screenshot and saving the page content
                        if(debugDir) {
                            fs.writeFile(debugDir + (i + 1) + '_content' + '.html', content, () => {});
                            await page.screenshot({path: debugDir + (i + 1) + '_screenshot' + '.png', fullPage: true});
                        }


                        // Using menu to save the file

                        console.log('Using menu to save the file');

                        // const toggleMenuHandle = await page.$('div[data-tooltip="main-menu"]');
                        await page.evaluate(_ => {
                            const mainMenu = document.querySelector('div[data-tooltip="main-menu"]');
                            const clickEvt =  document.createEvent("MouseEvents");
                            clickEvt.initEvent("mousedown", true, true); 
                            mainMenu.dispatchEvent(clickEvt);
                          });
                        
                        await sleep(200);

                        let menuItemFileHandle = await page.$('div[data-testid="dropdown-option-File"]');
                        let waitCnt = 10;
                        while (!menuItemFileHandle && waitCnt > 0) {
                            await sleep(100);
                            waitCnt--;
                            menuItemFileHandle = await page.$('div[data-testid="dropdown-option-File"]');
                        }

                        if(debugDir && !menuItemFileHandle) {
                            console.log('cannot open main menu')
                            fs.writeFile(debugDir + (i + 1) + '_main_menu' + '.html', content, () => {});
                            await page.screenshot({path: debugDir + (i + 1) + '_main_menu_screenshot' + '.png', fullPage: true});
                        }

                
                        const box = await menuItemFileHandle.boundingBox();
                        await page.mouse.move(box.x + 5, box.y + 5);

                        await sleep(200);
                        let submenuFileHandle = await page.$('div[data-testid="dropdown-option-Save local copy…"]');

                        waitCnt = 10;
                        while (!submenuFileHandle && waitCnt > 0) {
                            await sleep(100);
                            waitCnt--;
                            submenuFileHandle = await page.$('div[data-testid="dropdown-option-Save local copy…"]');
                        }

                        if(debugDir && !submenuFileHandle) {
                            console.log('cannot open file menu')
                            fs.writeFile(debugDir + (i + 1) + '_file_menu' + '.html', content, () => {});
                            await page.screenshot({path: debugDir + (i + 1) + '_file_menu_screenshot' + '.png', fullPage: true});
                        }

                        
                        const saveFileBox = await submenuFileHandle.boundingBox();
                        await page.mouse.move(saveFileBox.x + 5, saveFileBox.y + 5);
                        await page.mouse.click(saveFileBox.x + 5, saveFileBox.y + 5);

                        let downloadedCheckTries = 1800;

                        for(let j = 0; j < downloadedCheckTries; j++) {
                            await sleep(1000);
                            let afterDownloadFilesNumber = fs.readdirSync(downloadDir).length;

                            if(afterDownloadFilesNumber === (beforeDownloadFilesNumber + 1)) {
                                console.log('Download complete');
                                break;
                            }
                            console.log(`${j} afterDownloadFilesNumber: ${afterDownloadFilesNumber}`)

                            if(j === (downloadedCheckTries - 1)) {
                                console.log('File is not downloaded during timeout')
                            }
                        }
                    } else {
                        console.log('Title format seems to be unrecognized, skipping the file')
                    }
                } else {
                    console.log('This file is protected against saving locally and sharing. Skipping')
                }
            }
        } catch (err) {
            console.error(err);
            continue;
        }
    }


    // Closing Chromium
    browser.close();
})();


// Sleep function

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}
