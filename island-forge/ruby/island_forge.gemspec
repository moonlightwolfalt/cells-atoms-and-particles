Gem::Specification.new do |s|
  s.name        = 'island_forge'
  s.version     = '2.0.0'
  s.summary     = 'Ruby client and CLI for Island Forge (AI Fortnite / UEFN island generator)'
  s.description = 'Generate Fortnite / UEFN island layouts through an Island Forge server, inspect map specs, ' \
                  'export markers and devices as CSV, and download UEFN packages and Verse files.'
  s.authors     = ['Island Forge']
  s.license     = 'MIT'
  s.files       = Dir['lib/**/*.rb', 'bin/*', 'data/*.json', 'README.md']
  s.bindir      = 'bin'
  s.executables = ['island-forge-rb']
  s.required_ruby_version = '>= 3.0'
end
