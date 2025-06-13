import React, { useState } from "react";
function UploadSection() {
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState(null);
  const handleSelectedUploadFilesChange = (e) => {
    setSelectedUploadFiles(Array.from(e.target.files));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    if (selectedUploadFiles.length === 0) {
      setUploadError("Please select a folder to upload.");
      setUploadLoading(false);
      return;
    }
    const formData = new FormData();
    selectedUploadFiles.forEach((file) => {
      formData.append("myFiles", file, file.webkitRelativePath);
    });

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Folder upload failed!");
      }

      const data = await response.json();
      setUploadSuccessMessage(data.message);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(
        err.message || "An unexpected error occurred during upload."
      );
    } finally {
      setUploadLoading(false);
      setSelectedUploadFiles([]);
      const fileInput = document.getElementById("uploadFileInput");
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };
  return (
    <div>
      <div>
        <h1>Upload Event Data Folder</h1>
        <form onSubmit={handleUploadSubmit} encType="multipart/form-data">
          <div>
            <label>Select Folder containing event data:</label>
            <input
              type="file"
              id="uploadFileInput"
              name="myFiles"
              webkitdirectory="true"
              directory="true"
              multiple
              required
              onChange={handleSelectedUploadFilesChange}
            />
          </div>
          <br />
          <button type="submit" disabled={uploadLoading}>
            {uploadLoading ? "Uploading..." : "Upload Folder"}
          </button>
        </form>
        <br />

        {uploadError && <div>Upload Error: {uploadError}</div>}
        {uploadSuccessMessage && <div>Uploaded Successfully!</div>}
      </div>
    </div>
  );
}
export default UploadSection;
