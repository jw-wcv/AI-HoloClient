class repo_maps {
  constructor(name, owner, path, message, content, api_response) {
    this.name = name;
    this.owner = owner;
    this.path = path;
    this.message = message;
    this.content = content;
    this.api_response = api_response;
  }
}

module.exports = repo_maps;
