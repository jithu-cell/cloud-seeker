/**
 * aws-exports.js  ←  place this in your /src folder
 *
 * FILL IN your own values from the AWS Cognito Console.
 * See SETUP_GUIDE.md for step-by-step instructions.
 *
 * ⚠️  NEVER commit real secrets to Git.
 *     This file is safe because it only contains PUBLIC Cognito identifiers
 *     (User Pool ID, App Client ID) — there are no secret keys here.
 */

const awsExports = {
  Auth: {
    Cognito: {
      //  ┌─────────────────────────────────────────────────────────────────┐
      //  │  Replace EVERY value below with your own from the AWS Console   │
      //  └─────────────────────────────────────────────────────────────────┘

      // 1. Your AWS region (e.g. "us-east-1", "eu-north-1", "ap-south-1")
      region: "us-east-1",

      // 2. User Pool ID  — looks like: us-east-1_AbCdEfGhI
      userPoolId: "eu-north-1_2WmnIZkq3",

      // 3. App Client ID  — looks like: 1abc2defghij3klmnopqrstu4v
      userPoolClientId: "7qau0i0ce9486315dhhk148a3k",
    },
  },
};

export default awsExports;
