all:
	@echo "BUILDING: C++ Component"
	@rm -rf src/build/
	@rm -rf src/.lock-wscript
	@rm -rf lib/node-proxy.node
	@cd src;node-waf configure build;cd .. 
	@cp src/build/*/node-proxy.node lib/node-proxy.node

clean:
	rm -rf src/build/
	rm -rf src/.lock-wscript
	rm -rf lib/node-proxy.node
	
test: all
	node test/test.js
