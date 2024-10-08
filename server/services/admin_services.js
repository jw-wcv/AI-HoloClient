const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const util = require('util');
const archiver = require('archiver');

// Convert fs.readdir and fs.rename to use promises
const readdir = util.promisify(fs.readdir);
const rename = util.promisify(fs.rename);

    function parseMarkdownContent(markdown) {
      const sections = markdown.split('---\n').filter(section => section.trim());
      const filesData = [];

      sections.forEach(section => {
          const lines = section.split('\n').filter(line => line.trim());
          let fileName = lines[0].replace(/###\s+/g, '').trim();

          if (!fileName.includes('.')) {
              if (fileName === 'README') {
                  fileName += '.md';
              } else if (fileName !== 'LICENSE') {
                  const codeLang = lines.find(line => line.startsWith('```'))?.match(/```(\w+)/)?.[1];
                  const extensionMap = {
                      js: '.js',
                      json: '.json',
                      apex: '.cls', // For Apex classes
                      html: '.html',
                      css: '.css',
                      scss: '.scss',
                      sass: '.sass',
                      less: '.less',
                      ts: '.ts',
                      jsx: '.jsx',
                      vue: '.vue',
                      py: '.py',
                      rb: '.rb',
                      php: '.php',
                      java: '.java',
                      cpp: '.cpp',
                      cs: '.cs',
                      go: '.go',
                      rs: '.rs',
                      sol: '.sol', // For Solidity files
                      mmd: '.mmd'  // For Mermaid files
                      // Add more language to extension mappings as needed
                  };
                  const extension = extensionMap[codeLang] || '.txt';
                  fileName += extension;
              }
          }

          let fileContent = '';
          const contentStartIndex = lines.findIndex(line => line.startsWith('```')) + 1;
          if (contentStartIndex > 0) {
              const contentEndIndex = lines.lastIndexOf('```');
              fileContent = lines.slice(contentStartIndex, contentEndIndex).join('\n');
          } else {
              fileContent = lines.slice(1).join('\n');
          }

          filesData.push({ fileName, fileContent: fileContent.trim() });
      });

      return filesData;
    }

    function compressDirectory(directoryPath, outputZipPath) {
      return new Promise((resolve, reject) => {
        // Create a file to stream archive data to
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Sets the compression level
        });
    
        // Listen for all archive data to be written
        output.on('close', function() {
          console.log(`Directory ${directoryPath} has been successfully compressed to ${outputZipPath}`);
          console.log(archive.pointer() + ' total bytes');
          resolve();
        });
    
        // Good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function(err) {
          if (err.code === 'ENOENT') {
            console.warn(err);
          } else {
            reject(err);
          }
        });
    
        // Catch errors explicitly
        archive.on('error', function(err) {
          reject(err);
        });
    
        // Pipe archive data to the file
        archive.pipe(output);
    
        // Append files from a directory
        archive.directory(directoryPath, false);
    
        // Finalize the archive (ie we are done appending files but streams have to finish yet)
        archive.finalize();
      });
    }

    async function removeDuplicateFileExtensions(directory) {
      try {
        const files = await readdir(directory);
        for (const file of files) {
          const newFileName = file.replace(/(\.\w+)\1$/, '$1');
          if (newFileName !== file) {
            await rename(path.join(directory, file), path.join(directory, newFileName));
            console.log(`Successfully renamed ${file} to ${newFileName}`);
          }
        }
      } catch (err) {
        console.error('Error processing directory:', err);
      }
    }

    async function removeUnwantedCharacters(directory) {
      try {
        const files = await readdir(directory);
        for (const file of files) {
          let newFileName = file.replace(/^##/, '');
          newFileName = newFileName.replace(/(\.\w+)\1$/, '$1');
          if (newFileName !== file) {
            await rename(path.join(directory, file), path.join(directory, newFileName));
            console.log(`Successfully renamed ${file} to ${newFileName}`);
          }
        }
      } catch (err) {
        console.error('Error processing directory:', err);
      }
    }

    async function removeVerboseExtensions(directory) {
      const extensionMap = {
        'js': ['javascript', 'node', 'js'],
        'md': ['markdown', 'text', 'bash'],
        'txt': ['text', 'plaintext'],
        'gitignore': ['txt', 'text', 'plaintext'],
        'json': ['Json', 'json'],
        'sol': ['solidity'],
        'cls': ['apex', 'java'], 
        'sh': ['bash'], 
        'rs': ['rust'], 
      };

      try {
        const files = await readdir(directory);
        for (const file of files) {
          let newFileName = file;
          // Go through each extension in the map
          for (const [ext, verboseList] of Object.entries(extensionMap)) {
            // Check each verbose extension for this extension
            for (const verbose of verboseList) {
              const regex = new RegExp(`\\.${ext}\\.${verbose}$`, 'i');
              if (file.match(regex)) {
                newFileName = file.replace(regex, `.${ext}`);
                break; // Break out of the inner loop as we found a match
              }
            }
            if (newFileName !== file) {
              // If the new file name has changed, we've done our replacement
              break; // Break out of the outer loop as we don't need further checks
            }
          }
          // Rename the file if the name has changed
          if (newFileName !== file) {
            await rename(path.join(directory, file), path.join(directory, newFileName));
            console.log(`Successfully renamed ${file} to ${newFileName}`);
          }
        }
      } catch (err) {
        console.error('Error processing directory:', err);
      }
    }



    // This function ensures that a file is created, overwriting any existing file with the same name.
    /*
    function createFile(filePath, fileContent) {
      // Ensures that the directory exists
      const directoryPath = path.dirname(filePath);
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      
      // Writes the file
      fs.writeFileSync(filePath, fileContent, 'utf8');
    }*/

    function createFile(filePath, fileContent) {
      // Hash function to shorten the filename if it's too long
      const hashFileName = (str) => {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(str).digest('hex');
      };
    
      try {
        const MAX_FILENAME_LENGTH = 255;
        const directoryPath = path.dirname(filePath);
        let filename = path.basename(filePath);
    
        // Ensures that the directory exists
        if (!fs.existsSync(directoryPath)) {
          fs.mkdirSync(directoryPath, { recursive: true });
        }
    
        // Shorten the filename if it exceeds the max length
        if (filename.length > MAX_FILENAME_LENGTH) {
          const fileExtension = path.extname(filename);
          const nameWithoutExtension = path.basename(filename, fileExtension);
          const hashedName = hashFileName(nameWithoutExtension);
          filename = `${hashedName}${fileExtension}`;
          filePath = path.join(directoryPath, filename);
        }
    
        // Writes the file
        fs.writeFileSync(filePath, fileContent, 'utf8');
      } catch (error) {
        if (error.code === 'ENAMETOOLONG') {
          console.error('Filename is too long, consider shortening it:', filename);
        } else {
          console.error('Error writing file:', error);
        }
      }
    }

    async function generateInvoice(client, invoiceNumber, startDate, endDate, hoursWorked, hourlyRate) {
      try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile('./excel/templates/InvoiceTemplate.xlsx');
          const worksheet = workbook.getWorksheet(1);
  
          worksheet.getCell('H1').value = invoiceNumber;
          worksheet.getCell('H4').value = new Date();
          worksheet.getCell('H5').value = `${startDate} to ${endDate}`;
          worksheet.getCell('C9').value = client;
          worksheet.getCell('G9').value = hoursWorked;
          worksheet.getCell('F9').value = hourlyRate;
          worksheet.getCell('H9').value = hoursWorked * hourlyRate;
          const totalAmount = hoursWorked * hourlyRate;
          worksheet.getCell('H16').value = totalAmount;
  
          const generatedPath = generateInvoiceFilePath(client, invoiceNumber, startDate, endDate);
          await workbook.xlsx.writeFile(generatedPath);
          console.log(`Debug: Invoice generated successfully at ${generatedPath}`);
          return generatedPath;
      } catch (error) {
          console.error(`Error generating invoice: ${error}`);
          throw error;
      }
    }

    function getCurrentDateParts() {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      console.log(`Debug: Current year - ${year}, month - ${month}`);
      return { year, month };
    }

    function generateInvoiceFilePath(client, invoiceNumber, startDate, endDate) {
      const { year, month } = getCurrentDateParts();
      const formattedStartDate = startDate.replace(/\//g, '-');
      const formattedEndDate = endDate.replace(/\//g, '-');
      const invoicePath = `./excel/invoices/${year}/${month}/Invoice_${client}_${invoiceNumber}_${formattedStartDate}_${formattedEndDate}.xlsx`;
      console.log(`Debug: Generated invoice path - ${invoicePath}`);
      ensureDirectoryExists(`./excel/invoices/${year}/${month}`);
      return invoicePath;
    }

    function ensureDirectoryExists(directoryPath) {
      if (!fs.existsSync(directoryPath)) {
          fs.mkdirSync(directoryPath, { recursive: true });
          console.log(`Debug: Created directory - ${directoryPath}`);
      } else {
          console.log(`Debug: Directory already exists - ${directoryPath}`);
      }
    }

  
    async function sendInvoiceEmail(clientEmail, client, invoiceNumber, startDate, endDate, hoursWorked, hourlyRate) {
        try {
            // First, generate the invoice
            const invoicePath = await generateInvoice(client, invoiceNumber, startDate, endDate, hoursWorked, hourlyRate);

            // Email setup
            const transporter = nodemailer.createTransport({
                service: 'gmail', // or your email service provider
                auth: {
                    user: 'jw@whaleconnected.io', // replace with your email
                    pass: 'oooe brgb zjvy apky' // replace with your email password or app-specific password
                }
            });

            let mailOptions = {
                from: 'jw@whaleconnected.io', // sender address
                to: clientEmail, // list of receivers
                subject: 'Subject: Invoice ' + invoiceNumber + ' for Jim Weglin / Whale Connected Consulting LLC for Week Ending ' + endDate, // Subject line
                attachments: [{
                    filename: `JimWeglinII_${client}_Inv-${invoiceNumber}_${startDate}-${endDate}.xlsx`,
                    path: invoicePath // file on the server
                }]
            }

            if (client == 'Link') {
                mailOptions.text = `Hello,
                    \nPlease find attached the invoice for the period ${startDate} to ${endDate}. 
                    \nHours worked: ${hoursWorked}.
                    \nHourly rate: $${hourlyRate}.
                    \nPlease ensure all payroll deposits are made directly into the bank account of Whale Connected Consulting LLC as previously arranged.
                    \nIf there are any questions, please feel free to contact me.
                    \nThanks, 
                    \nJim Weglin`;
            } else if (client == 'SaltClick') {
                mailOptions.text = `Hello,
                    \nAttached is a snapshot of my approved hours from our time tracking system Tempo and the weekly invoice for Jim Weglin. 
                    \nPlease ensure all payroll deposits are made directly into the bank account of Whale Connected LLC as previously arranged.
                    \nIf there are any questions, please feel free to contact me.
                    \nThanks, 
                    \nJim Weglin`;
            }

            // Send the email
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully');
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
            // throw error;
        }
    }
    

module.exports = { compressDirectory, removeVerboseExtensions, removeUnwantedCharacters, removeDuplicateFileExtensions, createFile, parseMarkdownContent, generateInvoice, sendInvoiceEmail };
