// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFTMarketplace is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds; // total number of items ever created
    Counters.Counter private _itemsSold; // total number of item sold

    uint256 listingPrice = 0.001 ether; // people have to pay to list their nft
    address payable owner; // Owner of the smart contract


    constructor() ERC721("Metaverse Tokens","META"){
        owner = payable(msg.sender);
    }

    mapping (uint256 => MarketItem) private idToMarketItem;

    struct MarketItem{
        uint256 tokenId;
        address payable seller;
        address payable owner;
        uint256 price;
        bool sold;
    }

    event MarketItemCreated (
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 price,
        bool sold
    );

    // Returns the listing price of the market
    function getListingPrice() public view returns(uint256){
        return listingPrice;
    }

    // update the listing price
    function updateListingPrice(uint _listingPrice) public payable{
        require(owner == msg.sender,"Only marketplace owner can update listing price");
        listingPrice = _listingPrice;
    }

    function createMarketItem(uint256 tokenId,uint256 price) private {
        require(price > 0,"Price must be greater than zero");
        require(msg.value == listingPrice,"Price must be equal to listing price");

        idToMarketItem[tokenId] = MarketItem(
            tokenId,
            payable(msg.sender),
            payable(address(this)),
            price,
            false
        );

        _transfer(msg.sender,address(this),tokenId);
        emit MarketItemCreated(tokenId,msg.sender,address(this),price,false);
    }

    // Mints a token and list it in the marketplace

    function createToken(string memory tokenURI,uint256 price) public payable returns(uint){
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _mint(msg.sender,newTokenId);
        _setTokenURI(newTokenId,tokenURI);
        createMarketItem(newTokenId,price);
        return newTokenId;
    }

    // Creating the sale of a marketplace item
    // Transfers ownership of the item as well as funds between parties
    function createMarketSale(uint256 tokenId) public payable {
        uint price = idToMarketItem[tokenId].price;
        address seller = idToMarketItem[tokenId].seller;
        require(msg.value == price,"Please submit the asking price in order to complete the purchase");
        idToMarketItem[tokenId].owner = payable(msg.sender);
        idToMarketItem[tokenId].sold = true;
        idToMarketItem[tokenId].seller = payable(address(0));
        _itemsSold.increment();
        _transfer(address(this),msg.sender,tokenId);
        payable(owner).transfer(listingPrice);
        payable(seller).transfer(msg.value);
    }

    // Returns all unsold market items

    function fetchMarketItems() public view returns(MarketItem[] memory){
        uint itemCount = _tokenIds.current();
        uint unsoldItemCount = _tokenIds.current() - _itemsSold.current();
        uint currentIndex = 0;

        MarketItem[] memory items = new MarketItem[](unsoldItemCount);

        for(uint i=0;i<itemCount;i++){
            if(idToMarketItem[i+1].owner == address(this)){
                uint currentId = i+1;
                MarketItem storage currentItem = idToMarketItem[currentId];
                items[currentIndex] = currentItem;
                currentIndex += 1;
            }
        }
        return items;
    }

    // Returns only itens that a user has purchased
    function fetchMyNFTs() public view returns(MarketItem[] memory){
        uint totalItemCount = _tokenIds.current();
        uint itemCount = 0;
        uint currentIndex =0;

        for(uint i=0;i<totalItemCount; i++){
            if(idToMarketItem[i+1].owner == msg.sender){
                itemCount += 1;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);
        for(uint i=0; i < totalItemCount; i++){
            if(idToMarketItem[i+1].owner == msg.sender){
                uint currentId = i+1;
                MarketItem storage currentItem = idToMarketItem[currentId];
                items[currentIndex] = currentItem;
                currentIndex += 1;
            }
        }
        return items;
    }

      // Returns only itens that a user has listed
    function fetchItemsListed() public view returns(MarketItem[] memory){
        uint totalItemCount = _tokenIds.current();
        uint itemCount = 0;
        uint currentIndex = 0;

        for(uint i=0;i<totalItemCount; i++){
            if(idToMarketItem[i+1].seller == msg.sender){
                itemCount += 1;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);
        for(uint i=0; i < totalItemCount; i++){
            if(idToMarketItem[i+1].seller == msg.sender){
                uint currentId = i+1; // it will work as the tokenId
                MarketItem storage currentItem = idToMarketItem[currentId];
                items[currentIndex] = currentItem;
                currentIndex += 1;
            }
        }
        return items;
    }

    // Allows user to resell a token they have purchased

    function resellToken(uint256 tokenId,uint256 price) public payable {
        require(idToMarketItem[tokenId].owner == msg.sender,"Only item owner can perform this operation");
        require(msg.value == listingPrice,"Price must be equal to listing price");
        idToMarketItem[tokenId].sold = false;
        idToMarketItem[tokenId].price = price;
        idToMarketItem[tokenId].seller = payable(msg.sender);
        idToMarketItem[tokenId].owner = payable(address(this));
        _itemsSold.decrement();
        _transfer(msg.sender,address(this),tokenId);
    }

    // Allow user to cancel their market listing

    function cancelItemListing(uint256 tokenId) public {
        require(idToMarketItem[tokenId].seller == msg.sender,"Only item seller can perform this operation");
        require(idToMarketItem[tokenId].sold == false,"Only cancel items which are not sold yet");
        idToMarketItem[tokenId].owner = payable(msg.sender);
        idToMarketItem[tokenId].seller = payable(address(0));
        idToMarketItem[tokenId].sold = true;
        _itemsSold.increment();
        payable(owner).transfer(listingPrice);
        _transfer(address(this),msg.sender,tokenId);
    }




}