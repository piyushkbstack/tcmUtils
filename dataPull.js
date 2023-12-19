const axios = require("axios");
const fs = require("fs");
const constants = require("./constants");

let totalCaseCount = 0;
let automatedCaseCount = 0;
let nonAutomatableCaseCount = 0;
let toBeAutomatedCaseCount = 0;
let obseleteTestCaseCount = 0;
let testCasesId = new Map();
let testCaseDetails = [];
const htmlTagRegex = /<\/?[a-z][a-z]?.*?>/gi;
const lineBreakRegex = /<br>/gi;
const newLineRegex = /(\r\n|\n|\r)/gm;

async function sleep(sec) {
  return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

async function callTcmApi(folderID, pageNumber = 0) {
  const url =
    constants.BASEURL +
    `/${constants.PROJECTID}/folder/${folderID}/test-cases?p=${pageNumber}`;
  const customHeaders = {
    cookie: constants.COOKIES,
  };

  let otherData = {
    headers: customHeaders,
  };

  const res = await axios.get(url, otherData);
  return res.data;
}

async function callTcmDetailsAPI(folderID, testCaseId) {
  const url =
    constants.BASEURL +
    `/${constants.PROJECTID}/folder/${folderID}/test-cases/${testCaseId}/detail`;
  const customHeaders = {
    cookie: constants.COOKIES,
  };

  let otherData = {
    headers: customHeaders,
  };
  let res = "";
  try {
    res = await axios.get(url, otherData);
  } catch {
    console.log(`Invalid request for ${url}`);
  }
  return res.data.data.test_case;
}

async function computeTestCaseData(folder, testCaseList) {
  for (let i = 0; i < testCaseList.length; i++) {
    const testCase = testCaseList[i];
    testCasesId.set(testCase.id, folder);
    const data = testCase.automation_status.value;
    switch (data) {
      case "not_automated":
        toBeAutomatedCaseCount += 1;
        // console.log(`NOT AUTOMATED CASES --- NAME:::${testCase.name}----${data}`);
        break;
      case "automated":
        // console.log(`Automated Cases --- NAME:::${testCase.name}----${data}`);
        automatedCaseCount += 1;
        break;
      case "cannot_be_automated":
        // console.log(`OTHER CASES --- NAME:::${testCase.name}----${data}`);
        nonAutomatableCaseCount += 1;
        break;
      case "automation_not_required":
        // console.log(`OTHER CASES --- NAME:::${testCase.name}----${data}`);
        nonAutomatableCaseCount += 1;
        break;
      case "obsolete":
        // console.log(`OTHER CASES --- NAME:::${testCase.name}----${data}`);
        obseleteTestCaseCount += 1;
        break;
      default:
        console.log(`OTHER CASES --- NAME:::${testCase.name}----${data}`);
        break;
    }
  }
}

function printAllRequiredData(product) {
  totalCaseCount = totalCaseCount - obseleteTestCaseCount;
  const percentAutomation = (
    (automatedCaseCount / totalCaseCount) *
    100
  ).toFixed(2);
  const finalResult = {
    Product: product,
    TotalTestCases: totalCaseCount,
    AutomatedCases: automatedCaseCount,
    NonAutomatableCases: nonAutomatableCaseCount,
    ToBeAutomatedCases: toBeAutomatedCaseCount,
    AutomationCoverage: `${percentAutomation}%`,
  };

  console.log(finalResult);

  totalCaseCount = 0;
  automatedCaseCount = 0;
  nonAutomatableCaseCount = 0;
  toBeAutomatedCaseCount = 0;
  obseleteTestCaseCount = 0;
}

async function extractTestCaseData(productFolders, productName = '') {
  for (const key in productFolders) {
    if (productFolders.hasOwnProperty(key)) {
      const folderID = productFolders[key];
      let nextPage = 1;
      while (nextPage !== null) {
        let testCasesData = await callTcmApi(folderID, nextPage);
        nextPage = testCasesData.info.next;
        if (nextPage === null) {
          totalCaseCount += testCasesData.cases_count[`${folderID}`];
        }
        const testCases = testCasesData.test_cases;
        await computeTestCaseData(productFolders[key], testCases);
      }
    }
  }

  printAllRequiredData(productName);
}

function convertToCSVString(productName, caseDetails) {
  const csvString = [
    "Id",
    "Name",
    "Description",
    "Priority",
    "AutomationStatus",
    "Steps",
    "ExpectedResult",
    "Tags",
    "AutomationMethod",
  ].join("|");

  const csvData = caseDetails.map((caseDetail) =>
    [
      caseDetail.Id,
      caseDetail.Name,
      caseDetail.Description,
      caseDetail.Priority,
      caseDetail.AutomationStatus,
      caseDetail.Steps,
      caseDetail.ExpectedResult,
      caseDetail.Tags,
      caseDetail.AutomationMethod,
    ].join("|")
  );

  const finalCsvString = [csvString, ...csvData].join("\n");

  fs.writeFile(`output_${productName}.csv`, finalCsvString, (err) => {
    if (err) {
      console.error("Error writing to file:", err);
    } else {
      console.log("String has been written to the file");
    }
  });
}

function processStepsData(stepsArray, expectedResult) {
  let steps = "";
  for (let j = 0; j < stepsArray.length; j++) {
    let step = "";
    let stepExpectedResult = "";
    if (stepsArray[j].hasOwnProperty("step")) {
      step = stepsArray[j].step;
      if (stepsArray[j].hasOwnProperty("expected_result")) {
        if (expectedResult === "" || expectedResult === null) {
          stepExpectedResult = stepsArray[j].expected_result?.replaceAll(
            newLineRegex,
            " "
          );
          stepExpectedResult = stepsArray[j].expected_result?.replaceAll(
            lineBreakRegex,
            " "
          );
          stepExpectedResult = stepsArray[j].expected_result?.replaceAll(
            htmlTagRegex,
            " "
          );
        } else {
          stepExpectedResult = stepsArray[j].expected_result?.replaceAll(
            newLineRegex,
            " "
          );
          stepExpectedResult = stepsArray[j].expected_result?.replaceAll(
            lineBreakRegex,
            " "
          );
          stepExpectedResult = stepsArray[j].expected_result?.replaceAll(
            htmlTagRegex,
            " "
          );
          expectedResult += `, ${stepExpectedResult}`;
        }
      }
    } else {
      step = stepsArray[j].replaceAll(lineBreakRegex, " ");
      step = stepsArray[j].replaceAll(htmlTagRegex, " ");
      steps += `, ${step}`;
    }
  }

  steps = steps.slice(2);
  if (expectedResult.startsWith(",")) {
    expectedResult = expectedResult.slice(2);
  }
  return [steps, expectedResult];
}

// Function to process a batch of test cases
async function processTestCasesBatch(testCasesBatch) {
  const batchPromises = testCasesBatch.map(async ([caseId, folderId]) => {
    let tagResults = "";
    console.log(`Fetching details in ${folderId} for ${caseId}`);
    const testCaseDetail = await callTcmDetailsAPI(folderId, caseId);
    let description = testCaseDetail.description;
    description = description?.replaceAll(lineBreakRegex, " ");
    description = description?.replaceAll(htmlTagRegex, " ");
    const stepsArray = testCaseDetail.steps || [];
    let expectedResult =
      testCaseDetail.expected_result?.replaceAll(lineBreakRegex, " ") || "";
    expectedResult =
      testCaseDetail.expected_result?.replaceAll(htmlTagRegex, " ") || "";
    const tagArray = testCaseDetail.tags || [];

    const stepsData = processStepsData(stepsArray, expectedResult);

    for (let k = 0; k < tagArray.length; k++) {
      const tag = tagArray[k];
      tagResults += `, ${tag}`;
    }

    tagResults = tagResults.slice(2);

    const details = {
      Id: testCaseDetail.identifier.trim(),
      Name: testCaseDetail.name.replaceAll(newLineRegex, " ").trim(),
      Description: description?.trim(),
      Priority: testCaseDetail.priority.name.trim(),
      AutomationStatus: testCaseDetail.automation_status.name.trim(),
      Steps: stepsData[0].trim(),
      ExpectedResult: stepsData[1].trim(),
      Tags: tagResults.trim(),
      AutomationMethod: testCaseDetail.case_type?.name.trim(),
    };
    testCaseDetails.push(details);
  });
  return await Promise.all(batchPromises);
}

// Process test cases in batches
// (async () => {
//   await extractTestCaseData(constants.SYSTEMSFOLDER);
//   printAllRequiredData(constants.PRODUCT.SYSTEMS);
//   // Convert the testCasesId map into an array of key-value pairs
//   const testCasesArray = Array.from(testCasesId);
//   // Define the batch size
//   const batchSize = 200;
//   // Calculate the number of batches required
//   const numberOfBatches = Math.ceil(testCasesArray.length / batchSize);
//   for (let i = 0; i < numberOfBatches; i++) {
//     const startIdx = i * batchSize;
//     const endIdx = (i + 1) * batchSize;
//     const testCasesBatch = testCasesArray.slice(startIdx, endIdx);
//     await processTestCasesBatch(testCasesBatch);
//     console.log(`Processed batch ${i + 1}/${numberOfBatches}`);
//     await sleep(5);
//   }
//   convertToCSVString(constants.PRODUCT.SYSTEMS, testCaseDetails);
// })();

// extractTestCaseFields(constants.SYSTEMSFOLDER);
extractTestCaseData(constants.A11YFOLDER, constants.PRODUCT.ACCESSIBILITY);
// extractTestCaseData(constants.INTEGRATIONFOLDERS, constants.PRODUCT.INTEGRATION);
// extractTestCaseData(constants.PRODUCT.SYSTEMS, constants.SYSTEMSFOLDER);
// extractTestCaseData(constants.PRODUCT.ACCESSIBILITY, constants.A11YFOLDER);
