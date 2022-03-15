
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra')
const puppeteer = require('puppeteer');

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

const settings = {
    downloadTimeout: 1800,
    selectorTimeout: 20000,
    navigationTimeout: 180000,
    launchTimeout: 120000,
    loginTimeout: 10000,
    pageOpenTimeout: 20000
}

const downloadFigmaFiles = async(config = {}) => {

    let {
        figmaLogin,
        figmaPassword,
        figmaFilesListFile,
        figmaUrl,
        downloadsBaseDir,
        debugDir,
        settingFile,
    } = config

    console.log('figmaFilesListFile', figmaFilesListFile)


    if(!figmaLogin || !figmaPassword || (!figmaFilesListFile && !figmaUrl))
    {
        console.log('Usage: <script_name> <figma_login> <figma_password> <figma_files_list_file> <downloads_base_dir> [<debug_dir>]');
        process.exit(1);
    }

    // Creating the directory for debug purposes

    if(debugDir) {
        if(!debugDir.endsWith('/')) {
            debugDir += '/';
        }
        fs.mkdirSync(debugDir, {recursive: true});

        console.log('Working in debug mode; content and screenshots of the file pages will be saved to the directory: ' + debugDir + '\n');
    }


    // Reading Figma files list file

    if (figmaFilesListFile) {
        fs.readFile(figmaFilesListFile, (err, data) => {
            if(err) throw err;
            figmaFilesList = JSON.parse(data);
        });
    }
    if (figmaUrl) {
        figmaFilesList = [
            {
                uri: figmaUrl
            }
        ]
    }

    if (settingFile) {
        let newSettings = {}
        const data = fs.readFileSync(settingFile);
        newSettings = JSON.parse(data);

        settings.downloadTimeout = newSettings.downloadTimeout ?? settings.downloadTimeout;
        settings.selectorTimeout = newSettings.selectorTimeout ?? settings.selectorTimeout;
        settings.navigationTimeout = newSettings.navigationTimeout ?? settings.navigationTimeout;
        settings.launchTimeout = newSettings.launchTimeout ?? settings.launchTimeout;
        settings.loginTimeout = newSettings.loginTimeout ?? settings.loginTimeout;
        settings.pageOpenTimeout = newSettings.pageOpenTimeout ?? settings.pageOpenTimeout;
    }

    console.log('settings: ', settings);

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


    // Launching Chrome
    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox'], timeout: settings.launchTimeout});
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(settings.navigationTimeout);

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

        await page.screenshot({path: debugDir + 'login_form_screenshot' + '.png', fullPage: true});

        // Clicking the submit button
        console.log('Clicking the submit button');
        await page.click(buttonSelector, {delay: 500});
        console.log('Waiting for an after-login page opening');


        // Sleeping for 10 seconds
        await sleep(settings.loginTimeout);

        await page.screenshot({path: debugDir + 'login_form_after_screenshot' + '.png', fullPage: true});

        // Waiting for an after-login page loading
        await page.waitForSelector(filebrowserSelector);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    // Processing Figma files

    for(let i = 0; i < figmaFilesList.length; i++) {
        let filePage = "" 
        if (figmaFilesList[i].uri && figmaFilesList[i].uri.startsWith("http")) {
            filePage = figmaFilesList[i].uri
        } else if (figmaFilesList[i].uri) {
            filePage = filePageBaseUrl + figmaFilesList[i].uri
            if (!filePage.endsWith("/")) {
                filePage += "/" 
            }
        } else {
            filePage = filePageBaseUrl + figmaFilesList[i].key + '/';
        }
        
        console.log('\nStarting to process new file (' + (i + 1) + '/' + figmaFilesList.length + '), url: ' + filePage);

        try {
            // Opening a file page
            console.log('Opening the file page: ' + filePage);
            let filePageResponse = await page.goto(filePage, {waitUntil: 'networkidle2'});


            // Checking status code
            console.log('Returned status: ' + filePageResponse.status());
            if(filePageResponse.status() !== 200) {
                console.log('Skipping the file');
                continue;
            } 
            // Sleeping for 10 seconds, waiting for a specific element in React-generated content
            await sleep(settings.pageOpenTimeout);
            await page.waitForSelector(fullscreenFilenameSelector);

            // Checking if the file is available to save locally

            let content = await page.content();

            if(content.includes('="Viewers can\'t copy or share this file."')) {
                console.log('This file is protected against saving locally and sharing. Skipping')
                continue;
            }
            // Getting and validating page title

            const title = await page.title();
            if(!title.endsWith(' – Figma')) {
                console.log(`Title format "${title}" seems to be unrecognized, skipping the file`)
                await page.screenshot({path: debugDir + 'login_screenshot' + '.png', fullPage: true});
                continue;
            }
            const fileName = title.replace(' – Figma', '').replaceAll('/', '_').replaceAll('|', '_').replaceAll('"', '_');
            // Getting the local path of the directory for the file to download

            let downloadDir = path.resolve(downloadsBaseDir);

            if(!downloadDir.endsWith('/')) {
                downloadDir += '/';
            }

            if(figmaFilesList[i].team) {
                downloadDir += 'TEAM ' + figmaFilesList[i].team + '/';
            }

            if(figmaFilesList[i].project) {
                downloadDir += 'PROJECT ' + figmaFilesList[i].project + '/';
            }
            if (!figmaFilesList[i].team && !figmaFilesList[i].project) {
                downloadDir += fileName + '/';
            }

            downloadDir = path.normalize(downloadDir)

            
            if (fs.existsSync(downloadDir + fileName+'.fig')) {
                const now = new Date().toISOString().substring(0, 19).replaceAll('T', '_').replaceAll(':','-');
                fse.moveSync(downloadDir + fileName+'.fig', downloadDir + fileName + '_' + now + '.fig')
            }

            if (fs.existsSync(downloadDir + fileName+'.jam')) {
                const now = new Date().toISOString().substring(0, 19).replaceAll('T', '_').replaceAll(':','-');
                fse.moveSync(downloadDir + fileName+'.jam', downloadDir + fileName + '_' + now + '.jam')
            }


            console.log(`Directory to save the file: ${downloadDir}${fileName}`);

            fs.mkdirSync(downloadDir, {recursive: true});
            console.log(`created`);


            // Set download behavior
            await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadDir});
            console.log(`Page.setDownloadBehavior done`);

            // Debug: making screenshot and saving the page content
            if(debugDir) {
                fs.writeFile(debugDir + (i + 1) + '_content' + '.html', content, () => {});
                await page.screenshot({path: debugDir + fileName + (i + 1) + '_screenshot' + '.png', fullPage: true});
            }

            await page.evaluate(_ => {
                const mainMenu = document.querySelector('div[data-tooltip="main-menu"]');
                const clickEvt =  document.createEvent("MouseEvents");
                clickEvt.initEvent("mousedown", true, true); 
                mainMenu.dispatchEvent(clickEvt);
            });

            await sleep(1000);


            console.log(`looking for download button`);

            let menuItemFileHandle = null;
            try {
                menuItemFileHandle = await page.waitForSelector('div[data-testid="dropdown-option-File"]', {timeout: settings.selectorTimeout});
            } catch (error) {
                if(debugDir && !menuItemFileHandle) {
                    console.log('cannot open main menu')
                    fs.writeFile(debugDir + fileName + '_main_menu' + '.html', content, () => {});
                    await page.screenshot({path: debugDir + fileName + '_main_menu_screenshot' + '.png', fullPage: true});
                }
                throw error;
            }
    
            const box = await menuItemFileHandle.boundingBox();
            await page.mouse.move(box.x + 5, box.y + 5);

            await sleep(200);
            let submenuFileHandle = null
            try {
                submenuFileHandle = await page.waitForSelector('div[data-testid="dropdown-option-Save local copy…"]', {timeout: settings.selectorTimeout});
            } catch (error) {
                try {
                    const newFileItem = await page.waitForSelector('div[data-testid="dropdown-option-New design file"]', {timeout: settings.selectorTimeout});
                    if (newFileItem) {
                        console.log('cannot save copy export not allowed')
                        continue;
                    }
                } catch (error) {
                    //ignore
                }

                if(debugDir && !submenuFileHandle) {
                    console.log('cannot open file menu')
                    fs.writeFile(debugDir + fileName + '_file_menu' + '.html', content, () => {});
                    await page.screenshot({path: debugDir + fileName + '_file_menu_screenshot' + '.png', fullPage: true});
                }
                throw error;
            }
            
            const saveFileBox = await submenuFileHandle.boundingBox();
            await page.mouse.move(saveFileBox.x + 5, saveFileBox.y + 5);
            await page.mouse.click(saveFileBox.x + 5, saveFileBox.y + 5);

            await page.screenshot({path: debugDir + fileName + '_after_savefile' + '.png', fullPage: true});

            let downloadedCheckTries = settings.downloadTimeout;

            for(let j = 0; downloadedCheckTries == 0 || j < downloadedCheckTries; j++) {
                await page.screenshot({path: debugDir + fileName + '_dl_try_' + j + '.png', fullPage: true});

                await sleep(1000);
                if (fs.existsSync(downloadDir + fileName+'.fig')) {
                    console.log('Download complete');
                    break;
                }
                if (fs.existsSync(downloadDir + fileName+'.jam')) {
                    console.log('Download complete');
                    break;
                }
                
                if (j % 30 == 0) {
                    console.log(`waiting file to download for ${parseInt(j / 60)} min ${j % 60} sec.`)
                }

                if(downloadedCheckTries > 0 && j === (downloadedCheckTries - 1)) {
                    console.log(`File ${downloadDir + fileName} is not downloaded during timeout`)
                }
            }
        } catch (err) {
            console.error(err);
            continue;
        }
    }

    // Closing Chromium
    browser.close();
}

module.exports = downloadFigmaFiles
