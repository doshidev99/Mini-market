const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFT Marketplace", function () {
  let NFTMarket;
  let nftMarket;
  let listingPrice;
  let contractOwner;
  let buyerAddress;
  let nftMarketAddress;

  const auctionPrice = ethers.utils.parseUnits("100", "ether");

  beforeEach(async () => {
    NFTMarket = await ethers.getContractFactory("NFTMarketplace");
    nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();
    nftMarketAddress = nftMarket.address;
    [contractOwner, buyerAddress] = await ethers.getSigners();
    listingPrice = await nftMarket.getListingPrice();
    listingPrice = listingPrice.toString();
  });

  const mintAndListNFT = async (tokenURI, auctionPrice) => {
    const transaction = await nftMarket.createToken(tokenURI, auctionPrice, {
      value: listingPrice,
    });
    const receipt = await transaction.wait();
    const tokenID = receipt.events[0].args.tokenId;
    return tokenID;
  };

  describe("Mint and list a new NFT token", function () {
    const tokenURI = "https://some-token.uri/";

    it("Should revert if price is zero", async () => {
      await expect(mintAndListNFT(tokenURI, 0)).to.be.revertedWith(
        "Price must be greater than zero"
      );
    });

    it("Should revert if listing price is not correct", async function () {
      await expect(
        nftMarket.createToken(tokenURI, auctionPrice, { value: 0 })
      ).to.be.revertedWith("Price must be equal to listing price");
    });

    it("Should create an NFT with the correct owner and tokenURI", async function () {
      const tokenID = await mintAndListNFT(tokenURI, auctionPrice);
      const mintedTokenURI = await nftMarket.tokenURI(tokenID);

      const ownerAddress = await nftMarket.ownerOf(tokenID);

      expect(ownerAddress).to.equal(nftMarketAddress);
      expect(mintedTokenURI).to.equal(tokenURI);
    });

    it("Should emit MarketItemCreated after successfully listing of NFT", async function () {
      const transaction = await nftMarket.createToken(tokenURI, auctionPrice, {
        value: listingPrice,
      });
      const receipt = await transaction.wait();
      const tokenID = receipt.events[0].args.tokenId;
      await expect(transaction)
        .to.emit(nftMarket, "MarketItemCreated")
        .withArgs(
          tokenID,
          contractOwner.address,
          nftMarketAddress,
          auctionPrice,
          false
        );
    });
  });

  describe("Execute sale of a marketplace item", function () {
    const tokenURI = "https://some-token.uri/";

    it("Should revert if auction price is not correct", async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await expect(
        nftMarket
          .connect(buyerAddress)
          .createMarketSale(newNftToken, { value: 20 })
      ).to.be.revertedWith(
        "Please submit the asking price in order to complete the purchase"
      );
    });

    it("Buy a new token and check token owner address", async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      const oldOwnerAddress = await nftMarket.ownerOf(newNftToken);

      // Now the owner is the marketplace address
      expect(oldOwnerAddress).to.equal(nftMarketAddress);
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(newNftToken, { value: auctionPrice });

      const newOwnerAddress = await nftMarket.ownerOf(newNftToken);
      // Now the new owner is the buyer address
      expect(newOwnerAddress).to.equal(buyerAddress.address);
    });
  });

  describe("Resale of a marketplace item", function () {
    const tokenURI = "https://some-token.uri/";

    it("Should revert if the token owner or listing price is not correct", async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(newNftToken, { value: auctionPrice });
      await expect(
        nftMarket.resellToken(newNftToken, auctionPrice, {
          value: listingPrice,
        })
      ).to.be.revertedWith("Only item owner can perform this operation");
      await expect(
        nftMarket
          .connect(buyerAddress)
          .resellToken(newNftToken, auctionPrice, { value: 0 })
      ).to.be.revertedWith("Price must be equal to listing price");
    });

    it("Buy a new token and then resell it", async () => {
      const newNftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(newNftToken, { value: auctionPrice });

      const tokenOwnerAddress = await nftMarket.ownerOf(newNftToken);
      // Now the new owner is the buyer address
      expect(tokenOwnerAddress).to.equal(buyerAddress.address);

      await nftMarket
        .connect(buyerAddress)
        .resellToken(newNftToken, auctionPrice, { value: listingPrice });

      const newTokenOwner = await nftMarket.ownerOf(newNftToken);

      // Now the new owner should be the marketplace address
      expect(newTokenOwner).to.equal(nftMarketAddress);
    });
  });

  describe("Fetch marketplace items", function () {
    const tokenURI = "https://some-token.uri/";

    it("Should fetch the correct number of unsold items", async () => {
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);

      let unsoldItems = await nftMarket.fetchMarketItems();
      expect(unsoldItems.length).is.equal(3);
    });

    it("Should fetch correct number of items that a user has purchased", async () => {
      let nftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);

      await nftMarket
        .connect(buyerAddress)
        .createMarketSale(nftToken, { value: auctionPrice });

      let buyerTotalItems = await nftMarket.connect(buyerAddress).fetchMyNFTs();
      expect(buyerTotalItems.length).is.equal(1);
    });

    it("Should fetch correct number of items listed by a user", async () => {
      await mintAndListNFT(tokenURI, auctionPrice);
      await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createToken(tokenURI, auctionPrice, { value: listingPrice });
      let ownerlistings = await nftMarket.fetchItemsListed();
      expect(ownerlistings.length).to.equal(2);
    });
  });

  describe("Cancel a Marketplace listing", function () {
    const tokenURI = "https://some-token.uri/";

    it("Should cancel and return the correct number of listings", async () => {
      let nftToken = await mintAndListNFT(tokenURI, auctionPrice);
      await nftMarket
        .connect(buyerAddress)
        .createToken(tokenURI, auctionPrice, { value: listingPrice });
      await nftMarket
        .connect(buyerAddress)
        .createToken(tokenURI, auctionPrice, { value: listingPrice });

      let unsoldItems = await nftMarket.fetchMarketItems();
      await expect(unsoldItems.length).is.equal(3);

      await nftMarket.cancelItemListing(nftToken);

      let newUnsoldItems = await nftMarket.fetchMarketItems();

      await expect(newUnsoldItems.length).is.equal(2);
    });
  });
});
