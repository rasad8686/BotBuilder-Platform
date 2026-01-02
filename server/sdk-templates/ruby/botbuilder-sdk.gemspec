Gem::Specification.new do |spec|
  spec.name          = "botbuilder-sdk"
  spec.version       = "1.0.0"
  spec.authors       = ["BotBuilder Team"]
  spec.email         = ["support@botbuilder.com"]

  spec.summary       = "Official BotBuilder SDK for Ruby"
  spec.description   = "Ruby SDK for interacting with the BotBuilder API"
  spec.homepage      = "https://github.com/botbuilder/sdk-ruby"
  spec.license       = "MIT"
  spec.required_ruby_version = ">= 2.7.0"

  spec.files         = Dir["lib/**/*", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]

  spec.add_dependency "faraday", "~> 2.0"
  spec.add_dependency "json", "~> 2.0"

  spec.add_development_dependency "rspec", "~> 3.0"
  spec.add_development_dependency "webmock", "~> 3.0"
end
