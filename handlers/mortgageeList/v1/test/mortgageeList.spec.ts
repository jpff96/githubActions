describe("Test mortgagee list", function() {
  require("dotenv").config();

  const expect = require("chai").expect;
  const asyncMortgageeList = require("../mortgageeList");

  this.timeout(20000);

  context("mortgagee list", function() {
    it("call mortgagee list - MOCK", async function() {
      /////////////////////////////////////////////////////////////////////////////////////////////
      // Arrange
      /////////////////////////////////////////////////////////////////////////////////////////////
      const event = require("../mocks/mortgagee-list-event.json");
      const context = {};

      /////////////////////////////////////////////////////////////////////////////////////////////
      // Act
      /////////////////////////////////////////////////////////////////////////////////////////////
      const mortgageeListResponse = await asyncMortgageeList.main(event, context);

      const resBody = JSON.parse(mortgageeListResponse.body);
      const { message } = resBody;

      /////////////////////////////////////////////////////////////////////////////////////////////
      // Assert
      /////////////////////////////////////////////////////////////////////////////////////////////

      // Validate Result
      expect(mortgageeListResponse.statusCode, "Call Return Status Code").to.eq(200);

      // Validate Data
      expect(message.provider, "provider").to.eq("MOCK");
      expect(message.resultCode, "resultCode").to.eq(200);
      expect(message.resultMessage, "resultMessage").to.eq("success");

      const { response } = message;
      expect(response.length, "mortgagee list length").to.eq(5);

      const mortgagee0 = response[0];
      expect(mortgagee0.name, "mort0 name").to.eq("Mortgage Company 1");
      expect(mortgagee0.loanNumber, "mort0 loanNumber").to.eq("100001");
      expect(mortgagee0.street, "mort0 street").to.eq("An example street #111");
      expect(mortgagee0.city, "mort0 city").to.eq("Los Angeles");
      expect(mortgagee0.state, "mort0 state").to.eq("CA");
      expect(mortgagee0.postalCode, "mort0 postalCode").to.eq("90001");
    });
  });
});
