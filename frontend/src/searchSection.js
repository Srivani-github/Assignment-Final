import React, { useState } from "react";
function SearchSection() {
  const [searchString, setSearchString] = useState("");
  const [earliestTime, setEarliestTime] = useState("");
  const [latestTime, setLatestTime] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeTaken, setSearchTimeTaken] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const handleSearchStringChange = (e) => setSearchString(e.target.value);
  const handleEarliestTimeChange = (e) => setEarliestTime(e.target.value);
  const handleLatestTimeChange = (e) => setLatestTime(e.target.value);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    setSearchTimeTaken(null);

    if (isNaN(earliestTime) || isNaN(latestTime)) {
      setSearchError(
        "Please enter valid epoch times for Earliest and Latest Time."
      );
      setSearchLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchString,
          startTime: earliestTime,
          endTime: latestTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch search results.");
      }

      const data = await response.json();
      setSearchResults(data.results);
      setSearchTimeTaken(data.searchTimeTakenMs);
    } catch (err) {
      setSearchError(
        err.message || "An unexpected error occurred during search."
      );
    } finally {
      setSearchLoading(false);
    }
  };
  return (
    <div>
      <div>
        <h1>Event Log Search</h1>

        <form onSubmit={handleSearch}>
          <div>
            <label>Query : </label>
            <input
              type="text"
              id="searchString"
              value={searchString}
              onChange={handleSearchStringChange}
              placeholder="value or field=value"
            />
          </div>
          <br />

          <div>
            <label>Earliest Time (Epoch) : </label>
            <input
              type="number"
              id="earliestTime"
              value={earliestTime}
              onChange={handleEarliestTimeChange}
              placeholder="e.g 1725850449"
              required
            />
          </div>
          <br />

          <div>
            <label htmlFor="latestTime">Latest Time (Epoch) : </label>
            <input
              type="number"
              id="latestTime"
              value={latestTime}
              onChange={handleLatestTimeChange}
              placeholder="e.g 1725855086"
              required
            />
          </div>
          <br />

          <button type="submit" disabled={searchLoading}>
            {searchLoading ? "Searching..." : "Search Events"}
          </button>
        </form>

        {searchError && <div>Error: {searchError}</div>}
      </div>
      <br />

      {searchResults.length > 0 && (
        <div>
          <h2>Search Results</h2>
          <p>
            Found {searchResults.length} matching{" "}
            {searchResults.length === 1 ? "event" : "events"} in{" "}
            <span>Search Time: {(searchTimeTaken).toFixed(2)} ms</span>.
          </p>

          <div>
            <table>
              <tbody>
                {searchResults.map((event, index) => (
                  <tr key={index}>
                    <td>File:{event._sourceFile}</td>
                    <td>|</td>
                    <td>src address:{event.srcaddr}</td>
                    <td>|</td>
                    <td>dest address:{event.dstaddr}</td>
                    <td>|</td>
                    <td>Action: {event.action}</td>
                    <td>|</td>
                    <td>Log Status:{event.logStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchLoading && <div>Loading search results...</div>}

      {searchResults.length === 0 && !searchLoading && !searchError && (
        <div>No events found for your search criteria.</div>
      )}
    </div>
  );
}
export default SearchSection;
