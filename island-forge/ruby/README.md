# Island Forge for Ruby

A client and command-line tool for an Island Forge server, using only the Ruby standard library.

```bash
ruby bin/island-forge-rb modes
ruby bin/island-forge-rb --mode horror --provider offline generate "abandoned hospital"
ruby bin/island-forge-rb validate abandoned-hospital.island.json
ruby bin/island-forge-rb markers abandoned-hospital.island.json > markers.csv
ruby bin/island-forge-rb devices-csv abandoned-hospital.island.json > devices.csv
ruby bin/island-forge-rb package abandoned-hospital.island.json
ruby bin/island-forge-rb verse abandoned-hospital.island.json -o Verse
```

Or build the gem with `gem build island_forge.gemspec`.

```ruby
require 'island_forge'

client = IslandForge::Client.new('http://localhost:5173')
spec = client.generate('candy factory', mode: 'simulator', provider: 'offline')
puts spec.summary
File.binwrite('candy.zip', client.package(spec))
```

## Tests

```bash
ruby -Ilib test/test_island_forge.rb
ISLAND_FORGE_SERVER=http://localhost:5173 ruby -Ilib test/test_island_forge.rb   # also runs against a real server
```
