const axios = require("axios");
const constants = require('./constants');


let totalCaseCount = 0;
let automatedCaseCount = 0;
let nonAutomatableCaseCount = 0;
let toBeAutomatedCaseCount = 0;

async function callTcmApi(folderID, pageNumber = 0) {
  const url =
    constants.BASEURL + `/${constants.PROJECTID}/folder/${folderID}/test-cases?p=${pageNumber}`;
  const customHeaders = {
    cookie: constants.COOKIES,
  };

  let otherData = {
    headers: customHeaders,
  };

  const res = await axios.get(url, otherData);
  return res.data;
}

function computeTestCaseData(testCaseList) {
  for (let i = 0; i < testCaseList.length; i++) {
    const testCase = testCaseList[i];
    const data = testCase.automation_status.value;
    switch (data) {
      case "not_automated":
        toBeAutomatedCaseCount += 1;
        // console.log(`NOT AUTOMATED CASES --- NAME:::${testCase.name}----${data}`);
        break;
      case "automated":
        automatedCaseCount += 1;
        break;
      case "cannot_be_automated":
        nonAutomatableCaseCount += 1;
        break;
      case "automation_not_required":
        nonAutomatableCaseCount += 1;
        break;
      default:
        console.log(`OTHER CASES --- NAME:::${testCase.name}----${data}`);
        break;
    }
  }
}

function printAllRequiredData(product) {
  const percentAutomation = ((automatedCaseCount / totalCaseCount) * 100).toFixed(2);
  const finalResult = {
    Product: product,
    TotalTestCases: totalCaseCount,
    AutomatedCases: automatedCaseCount,
    NonAutomatableCases: nonAutomatableCaseCount,
    ToBeAutomatedCases: toBeAutomatedCaseCount,
    AutomationCoverage: `${percentAutomation}%`
  }

  console.log(finalResult);
}

async function extractTestCaseData(product, productFolders) {
  for (const key in productFolders) {
    if (productFolders.hasOwnProperty(key)) {
      console.log(`PROJECT NAME::: ${key}`);
      const folderID = productFolders[key];
      let nextPage = 1;
      while (nextPage !== null) {
        let testCasesData = await callTcmApi(
          folderID,
          nextPage
        );
        nextPage = testCasesData.info.next;
        if (nextPage === null) {
          totalCaseCount += testCasesData.cases_count[`${folderID}`];
        }
        const testCases = testCasesData.test_cases;
        computeTestCaseData(testCases)
      }
    }
  }

  printAllRequiredData(product)
}

extractTestCaseData(constants.PRODUCT.INTEGRATION, constants.INTEGRATIONFOLDERS);