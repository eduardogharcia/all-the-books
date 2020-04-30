const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')
const filenamify = require('filenamify')

const booksUrls = require('./books-urls.js')

const baseURL = 'https://link.springer.com'
const chunkSize = 3 // concurrent donwnloads

/**
 * Return a Promise the resolve after given miliseconds
 * @param {Number} ms Miliseconds to sleep
 * @returns {Pomise}
 */
const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retrieve book information from the page
 * @param {String} bookPageURL
 * @return {Object} bookInfo
 */
const getBookInfo = async (bookPageURL) => {
  const page = await axios.get(bookPageURL)
  const $ = cheerio.load(page.data)
  
  const bookTitle = $('.page-title h1').text()

  const files = []

  $('.cta-button-container.cta-button-container--stacked.u-pt-36 a[class*="test-book"]').each((index, el) => {
    files.push($(el).attr('href'))   
  })

  return {
    name: bookTitle,
    files
  }
}

/**
 * Download file from given url and save using bookname
 * @param {String} bookName 
 * @param {String} bookURL
 * @returns {Promise} Promise representing downloaded file
 */
const downloadFile = async (bookName, bookURL) => {
  const ext = path.extname(bookURL)
  const writter = fs.createWriteStream(`dist/${filenamify(bookName)}${ext}`)

  try {
    const response = await axios({
      url: bookURL,
      method: 'GET',
      responseType: 'stream'
    })
    response.data.pipe(writter)
  } catch (error) {
    console.log(`Can't download file: ${bookURL}`)
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    writter.on('finish', resolve)
    writter.on('error', reject)
  })
}

/**
 * 
 * @param {String} pageURL 
 * @returns {Promise}
 */
const downloadEbook = async (pageURL) => {
  const bookInfo = await getBookInfo(pageURL)
  const booksProms = []

  bookInfo.files.forEach(fileURL => {
    booksProms.push(downloadFile(bookInfo.name, baseURL + fileURL))
  })
  return Promise.all(booksProms)
}

const main = async () => {
  console.log('started')

  const qtyAllBooksToDownload = booksUrls.length
  let qtyBooksDownloaded = 0
  let promsBooksToDownload = []
 
  for (let index = 0; index < qtyAllBooksToDownload; index++) {
    const url = booksUrls[index];
    promsBooksToDownload.push(downloadEbook(url))

    if (promsBooksToDownload.length === chunkSize || index >= qtyAllBooksToDownload - 1) {
      await Promise.all(promsBooksToDownload)
      promsBooksToDownload = [] // reset

      qtyBooksDownloaded = qtyBooksDownloaded + chunkSize
      const percent = (qtyBooksDownloaded / qtyAllBooksToDownload) * 100
      console.log(`${qtyBooksDownloaded}/${qtyAllBooksToDownload} - ${percent.toFixed(2)}%`)

      await sleep(2000)
    }
    
  }

  console.log('finished')
}

main()