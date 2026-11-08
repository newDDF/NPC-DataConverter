import type { LegalDocuments } from "./types";

const enLegal: LegalDocuments = {
  privacy: {
    effectiveDate: "November 1, 2026",
    introduction:
      "This Privacy Policy explains how this data conversion service handles information when you visit or use the website. We aim to minimize the collection of personal information and to process conversion data in your browser whenever the selected feature supports local processing.",
    sections: [
      {
        title: "1. Data Processing",
        paragraphs: [
          "Text and files selected for conversion are processed by the application in your browser. The application is designed not to send the contents of your data files to us as part of the normal conversion workflow. Processing behavior may depend on your browser, enabled features, and the version of the application you are using.",
          "You are responsible for checking the contents of your files and avoiding the use of sensitive or confidential information unless you have determined that the service is appropriate for that information.",
        ],
      },
      {
        title: "2. Website and Technical Information",
        paragraphs: [
          "The website hosting provider or infrastructure may automatically process limited technical information when you access the site. This may include IP address, browser and device information, requested pages, timestamps, and security or diagnostic logs. Such information is generally used to deliver, maintain, and protect the website.",
        ],
      },
      {
        title: "3. Cookies and Local Storage",
        paragraphs: [
          "The application may use browser storage or similar technologies for essential interface preferences or functionality. We do not claim that the hosting platform or future integrations never use cookies or other technical storage. You can manage browser storage and cookie settings through your browser.",
        ],
      },
      {
        title: "4. Third-Party Services",
        paragraphs: [
          "The website may rely on third-party hosting, libraries, or external links. Those providers operate under their own privacy policies and terms. When you follow an external link, your interaction is governed by the destination website's policies. We do not control third-party data practices.",
        ],
      },
      {
        title: "5. Data Retention and Security",
        paragraphs: [
          "The application does not provide an account-based file storage service. Files processed in the browser remain subject to your browser session and device behavior. Technical logs held by hosting providers may be retained according to their own policies.",
          "No website or data transmission method can be guaranteed completely secure. Keep your own copies of important files and use appropriate device security practices.",
        ],
      },
      {
        title: "6. Children's Privacy",
        paragraphs: [
          "This service is not specifically directed at children. We do not knowingly request personal information from children through the conversion interface.",
        ],
      },
      {
        title: "7. Policy Updates",
        paragraphs: [
          "This policy may be updated as the application, infrastructure, or applicable requirements change. The latest version will be published on this page with an updated effective date.",
        ],
      },
    ],
    footerPrefix: "For project information, visit the",
    linkLabel: "project maintainer's GitHub profile",
    footerSuffix: ".",
  },
  terms: {
    effectiveDate: "November 1, 2026",
    introduction:
      "By accessing or using this data conversion service, you agree to these Terms of Service. If you do not agree, please discontinue use of the service.",
    sections: [
      {
        title: "1. Service Description",
        paragraphs: [
          "This project provides browser-based tools for parsing, previewing, and converting supported data formats. Features, supported formats, and behavior may change as the project develops.",
        ],
      },
      {
        title: "2. Acceptable Use",
        paragraphs: [
          "You agree to use the service lawfully and responsibly. You must not use it to violate applicable laws, infringe the rights of others, interfere with the website, attempt unauthorized access, or distribute malicious content.",
        ],
      },
      {
        title: "3. Your Data and Responsibilities",
        paragraphs: [
          "You retain responsibility for the data and files you submit to the application. You must have the necessary rights and permissions to use that content. Always review conversion results for completeness, formatting, and accuracy before relying on them.",
          "You are responsible for maintaining independent backups of important source files and converted results. Do not treat this service as your sole data storage or backup solution.",
        ],
      },
      {
        title: "4. No Professional Advice",
        paragraphs: [
          "Conversion results are provided as a technical convenience and are not professional, legal, financial, or other specialized advice. You should independently verify results before using them in business-critical, regulated, or other high-impact workflows.",
        ],
      },
      {
        title: "5. Intellectual Property",
        paragraphs: [
          "The website's original design, code, and branding are protected by applicable intellectual property laws. Third-party libraries and components remain subject to their respective licenses. These terms do not transfer ownership of your input data to the project maintainer.",
        ],
      },
      {
        title: "6. Availability and Changes",
        paragraphs: [
          "The service is provided free of charge and may be modified, suspended, or discontinued at any time. We do not guarantee uninterrupted availability, compatibility with every file, or continued support for any particular feature.",
        ],
      },
      {
        title: "7. Disclaimer of Warranties",
        paragraphs: [
          'To the extent permitted by applicable law, the service is provided "as is" and "as available", without warranties of any kind, whether express or implied. We do not warrant that the service will be error-free, secure, or suitable for every purpose.',
        ],
      },
      {
        title: "8. Limitation of Liability",
        paragraphs: [
          "To the extent permitted by applicable law, the project maintainer shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or business arising from or related to the use or inability to use the service.",
        ],
      },
      {
        title: "9. Changes to These Terms",
        paragraphs: [
          "These terms may be revised as the service evolves. Continued use of the service after updated terms are published constitutes acceptance of the revised terms to the extent permitted by applicable law.",
        ],
      },
    ],
    footerPrefix: "This project is maintained independently. Visit",
    linkLabel: "GitHub.com/newddf",
    footerSuffix: "for project information.",
  },
};

export default enLegal;
