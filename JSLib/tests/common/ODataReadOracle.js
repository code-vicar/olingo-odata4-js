// Copyright (c) Microsoft Open Technologies, Inc.  All rights reserved.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation 
// files (the "Software"), to deal  in the Software without restriction, including without limitation the rights  to use, copy,
// modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the 
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR  IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY,  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Client for the odata.read oracle service

(function (window, undefined) {
    var jsonMime = "application/json";
    var universalMime = "*/*";
    var atomMime = "application/atom+xml";

    var readFeed = function (url, success, mimeType, recognizeDates) {
        /// <summary>Calls the ReadFeed endpoint with the specified URL</summary>
        /// <param name="url" type="String">The URL to read the feed from</param>
        /// <param name="success" type="Function">The success callback function</param>
        /// <param name="mimeType" type="String">The MIME media type in the Accept header</param>
        var readMethod = getReadMethod(mimeType, "ReadFeed");
        oracleRequest("GET", readMethod, typeof url === "string" ? { url: url} : url, mimeType, recognizeDates, function (data) {
            success(data);
        });
    };

    var readEntry = function (url, success, mimeType, recognizeDates) {
        /// <summary>Calls the ReadEntry endpoint with the specified URL</summary>
        /// <param name="url" type="String">The URL to read the entry from</param>
        /// <param name="success" type="Function">The success callback function</param>
        /// <param name="mimeType" type="String">The MIME media type in the Accept header</param>
        var readMethod = getReadMethod(mimeType, "ReadEntry");
        oracleRequest("GET", readMethod, typeof url === "string" ? { url: url} : url, mimeType, recognizeDates, success);
    };

    var readFeedLoopback = function (atomFeedXml, success, recognizeDates) {
        /// <summary>Calls the ReadFeedLoopback endpoint with the specified atom feed xml</summary>
        /// <param name="atomFeedXml" type="String">The atom feed xml</param>
        /// <param name="success" type="Function">The success callback function</param>
        oracleRequest("POST", "ReadFeedLoopback", atomFeedXml, atomMime, recognizeDates, success);
    };

    var readEntryLoopback = function (atomEntryXml, success, recognizeDates) {
        /// <summary>Calls the ReadEntryLoopback endpoint with the specified atom entry xml</summary>
        /// <param name="atomEntryXml" type="String">The atom entry xml</param>
        /// <param name="success" type="Function">The success callback function</param>
        oracleRequest("POST", "ReadEntryLoopback", atomEntryXml, atomMime, recognizeDates, success);
    };

    var readLinksEntry = function (url, success) {
        /// <summary>Calls the ReadMetadata endpoint with the specified URL</summary>
        /// <param name="url" type="String">The URL to read the metadata from</param>
        /// <param name="success" type="Function">The success callback function</param>
        readJson(
            url,
            success
        );
    };

    var readLinksFeed = function (url, success) {
        /// <summary>Calls the ReadMetadata endpoint with the specified URL</summary>
        /// <param name="url" type="String">The URL to read the metadata from</param>
        /// <param name="success" type="Function">The success callback function</param>
        readJson(
            url,
            function (data) {
                success(data);
            }
        );
    };

    var readMetadata = function (url, success) {
        /// <summary>Calls the ReadMetadata endpoint with the specified URL</summary>
        /// <param name="url" type="String">The URL to read the metadata from</param>
        /// <param name="success" type="Function">The success callback function</param>
        oracleRequest("GET", "ReadMetadata", typeof url === "string" ? { url: url} : url, null, null, success);
    };

    var readServiceDocument = function (url, success, mimeType) {
        /// <summary>Calls the ReadServiceDocument endpoint with the specified URL</summary>
        /// <param name="url" type="String">The URL to the service</param>
        /// <param name="success" type="Function">The success callback function</param>
        /// <param name="mimeType" type="String">The MIME type being tested</param>
        var readMethod = getReadMethod(mimeType, "ReadServiceDocument");
        oracleRequest("GET", readMethod, typeof url === "string" ? { url: url} : url, mimeType, null, success);
    };

    var readJson = function (url, success) {
        $.ajax({
            url: url,
            accepts: null,
            dataType: "json",
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Accept", jsonMime);
                xhr.setRequestHeader("OData-MaxVersion", "4.0");
            },
            success: function (data) {
                success(data);
            }
        });
    };

    var readJsonAcrossServerPages = function (url, success) {
        var data = {};
        var readPage = function (url) {
            readJson(url, function (feedData) {
                var nextLink = feedData["@odata.nextLink"];
                if (nextLink) {
                    var index = url.indexOf(".svc/", 0);
                    if (index != -1) {
                        nextLink = url.substring(0, index + 5) + nextLink;
                    }
                }

                if (data.value && feedData.value) {
                    data.value = data.value.concat(feedData.value);
                }
                else {
                    for (var property in feedData) {
                        if (property != "@odata.nextLink") {
                            data[property] = feedData[property];
                        }
                    }
                }

                if (nextLink) {
                    readPage(nextLink);
                }
                else {
                    success(data);
                }
            });
        };

        readPage(url);
    };

    var getReadMethod = function (mimeType, defaultEndpoint) {
        switch (mimeType) {
            case atomMime:
                return defaultEndpoint;
            case jsonMime:
            case universalMime:
            default:
                return "ReadJson";
        }
    };

    var oracleRequest = function (method, endpoint, data, mimeType, recognizeDates, success) {
        /// <summary>Requests a JSON object from the oracle service, removing WCF-specific artifacts</summary>
        /// <param name="method" type="String">The HTTP method (GET or POST)</param>
        /// <param name="endpoint" type="String">The oracle endpoint</param>
        /// <param name="data" type="Object">The data to send with the request</param>
        /// <param name="reviver" type="Function">The reviver function to run on each deserialized object</param>
        /// <param name="success" type="Function">Success callback</param>
        var url = "./common/ODataReadOracle.svc/" + endpoint;
        if (mimeType) {
            data.mimeType = mimeType;
        }

        $.ajax({
            type: method,
            url: url,
            data: data,
            dataType: "text",
            success: function (data) {
                var json = JSON.parse(data);
                success(json);
            }
        });
    };

    var removeProperty = function (data, property) {
        /// <summary>Removes the specified property recursively from the given object</summary>
        /// <param name="data" type="Object">The object to operate on</param>
        /// <param name="property" type="String">The name of the property to remove</param>
        if (typeof data === "object" && data !== null) {
            if (data[property]) {
                delete data[property];
            }

            for (prop in data) {
                removeProperty(data[prop], property);
            }
        }
    };

    window.ODataReadOracle = {
        readFeed: readFeed,
        readEntry: readEntry,
        readFeedLoopback: readFeedLoopback,
        readEntryLoopback: readEntryLoopback,
        readLinksEntry: readLinksEntry,
        readLinksFeed: readLinksFeed,
        readJson: readJson,
        readJsonAcrossServerPages: readJsonAcrossServerPages,
        readMetadata: readMetadata,
        readServiceDocument: readServiceDocument
    };
})(window);