import MagicString from 'magic-string';
import { dirname, normalize, relative } from '../../utils/path';
import { PluginDriver } from '../../utils/pluginDriver';
import { RenderOptions } from '../../utils/renderHelpers';
import Identifier from './Identifier';
import Literal from './Literal';
import MemberExpression from './MemberExpression';
import * as NodeType from './NodeType';
import { NodeBase } from './shared/Node';

const getResolveUrl = (path: string, URL: string = 'URL') => `new ${URL}(${path}).href`;

const getRelativeUrlFromDocument = (relativePath: string) =>
	getResolveUrl(
		`(document.currentScript && document.currentScript.src || document.baseURI) + '/../${relativePath}'`
	);

const relativeUrlMechanisms: Record<string, (relativePath: string) => string> = {
	amd: relativePath => getResolveUrl(`module.uri + '/../${relativePath}', document.baseURI`),
	cjs: relativePath =>
		`(typeof document === 'undefined' ? ${getResolveUrl(
			`'file:' + __dirname + '/${relativePath}'`,
			`(require('u' + 'rl').URL)`
		)} : ${getRelativeUrlFromDocument(relativePath)})`,
	es: relativePath => getResolveUrl(`'${relativePath}', import.meta.url`),
	iife: relativePath => getRelativeUrlFromDocument(relativePath),
	system: relativePath => getResolveUrl(`'${relativePath}', module.meta.url`),
	umd: relativePath =>
		`(typeof document === 'undefined' ? ${getResolveUrl(
			`'file:' + __dirname + '/${relativePath}'`,
			`(require('u' + 'rl').URL)`
		)} : ${getRelativeUrlFromDocument(relativePath)})`
};

export default class MetaProperty extends NodeBase {
	meta: Identifier;
	property: Identifier;
	rendered: boolean;
	type: NodeType.tMetaProperty;

	initialise() {
		if (this.meta.name === 'import') {
			this.rendered = false;
			this.context.addImportMeta(this);
		}
		this.included = false;
	}

	render(code: MagicString, options: RenderOptions) {
		if (this.meta.name === 'import') this.rendered = true;
		super.render(code, options);
	}

	renderFinalMechanism(
		code: MagicString,
		chunkId: string,
		format: string,
		pluginDriver: PluginDriver
	): boolean {
		if (!this.included || !(this.parent instanceof MemberExpression)) return false;

		const parent = this.parent;

		let importMetaProperty: string;
		if (parent.property instanceof Identifier) importMetaProperty = parent.property.name;
		else if (parent.property instanceof Literal && typeof parent.property.value === 'string')
			importMetaProperty = parent.property.value;
		else return false;

		// support import.meta.ROLLUP_ASSET_URL_[ID]
		if (importMetaProperty.startsWith('ROLLUP_ASSET_URL_')) {
			const assetFileName = this.context.getAssetFileName(importMetaProperty.substr(17));
			const relativeAssetPath = normalize(relative(dirname(chunkId), assetFileName));
			const replacement =
				pluginDriver.hookFirstSync<string | void>('resolveAssetUrl', [
					{
						assetFileName,
						chunkId,
						moduleId: this.context.module.id,
						relativeAssetPath
					}
				]) || relativeUrlMechanisms[format](relativeAssetPath);

			code.overwrite(parent.start, parent.end, replacement);
			return true;
		}

		if (importMetaProperty === 'url') {
			const replacement = pluginDriver.hookFirstSync<string | void>('resolveImportMetaUrl', [
				{
					chunkId,
					format,
					moduleId: this.context.module.id
				}
			]);
			if (typeof replacement === 'string') {
				code.overwrite(parent.start, parent.end, replacement);
			}
			return true;
		}

		return false;
	}
}
